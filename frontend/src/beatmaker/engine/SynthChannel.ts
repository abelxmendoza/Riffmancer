import * as Tone from 'tone'
import type { SynthPatch } from '../genres'
import { midiToFrequency } from '../theory'
import { getInstrument, instrumentSource } from '../../song/instruments'

/**
 * One polyphonic synthesizer with its own effect rack:
 * oscillator → filter (with envelope) → drive → chorus → delay → reverb → volume.
 * Used for the bass, the chord instrument, and the playable lead synth.
 * A patch with `sample` plays a recorded instrument (Tone.Sampler) through the same rack instead.
 */
export class SynthChannel {
  readonly synth: Tone.PolySynth<Tone.MonoSynth>
  private readonly drive = new Tone.Distortion({ distortion: 0, oversample: '2x', wet: 0 })
  private readonly cabinet = new Tone.Filter({ type: 'lowpass', frequency: 7000, rolloff: -24 })
  private readonly chorus = new Tone.Chorus({ frequency: 1.2, delayTime: 3.5, depth: 0.7, spread: 180, wet: 0 }).start()
  private readonly delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0 })
  private readonly reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.01, wet: 0 })
  readonly output = new Tone.Volume(0)
  private patch: SynthPatch
  /** Held notes with the frequency they were attacked at, so a later octave change can't strand them. */
  private readonly held = new Map<number, { count: number; frequency: number }>()
  /** The recorded instrument, when the patch names one and it has loaded. */
  private sampler?: Tone.Sampler
  private samplerId?: string
  private samplerReady: Promise<void> = Promise.resolve()
  private readonly sampleTone = new Tone.Filter({ type: 'lowpass', frequency: 14000, rolloff: -12 })

  constructor(patch: SynthPatch, voices = 8) {
    this.patch = patch
    this.synth = new Tone.PolySynth(Tone.MonoSynth, { maxPolyphony: voices } as never)
    this.synth.chain(this.drive, this.cabinet, this.chorus, this.delay, this.reverb, this.output)
    this.sampleTone.connect(this.drive)
    this.applyPatch(patch)
  }

  get currentPatch(): SynthPatch {
    return this.patch
  }

  applyPatch(patch: SynthPatch) {
    this.patch = patch
    const fat = patch.wave.startsWith('fat')
    this.synth.set({
      oscillator: fat ? { type: patch.wave, spread: patch.spread, count: 3 } : { type: patch.wave },
      envelope: { attack: patch.attack, decay: patch.decay, sustain: patch.sustain, release: patch.release },
      filter: { type: 'lowpass', Q: patch.resonance, rolloff: -24 },
      filterEnvelope: {
        attack: Math.min(patch.attack, 0.05),
        decay: patch.filterDecay,
        sustain: 0,
        release: patch.release,
        baseFrequency: patch.cutoff,
        octaves: Math.max(0, patch.filterEnv),
      },
      portamento: patch.glide,
    } as never)
    this.drive.distortion = patch.drive
    this.drive.wet.value = patch.drive > 0 ? 1 : 0
    this.cabinet.frequency.value = patch.drive > 0.4 ? 5200 : 12000
    this.chorus.wet.value = patch.chorus
    this.delay.wet.value = patch.delay * 0.6
    this.reverb.wet.value = patch.reverb
    this.synth.volume.value = patch.volume
    this.useSample(patch)
  }

  /** Resolves once the current recorded instrument (if any) has loaded or failed. */
  loaded(): Promise<void> {
    return this.samplerReady
  }

  /** True while a recorded instrument is playing instead of the synth. */
  get sampled(): boolean {
    return Boolean(this.sampler?.loaded)
  }

  private useSample(patch: SynthPatch) {
    const instrument = getInstrument(patch.sample)
    if (instrument?.id !== this.samplerId) {
      const old = this.sampler
      if (old) { old.releaseAll(); window.setTimeout(() => old.dispose(), 2000) }
      this.sampler = undefined
      this.samplerId = instrument?.id
      const source = instrument && instrumentSource(instrument.id)
      if (instrument && source) {
        this.samplerReady = new Promise<void>((resolve) => {
          const sampler = new Tone.Sampler({
            urls: source.urls,
            baseUrl: source.baseUrl,
            onload: () => { if (this.samplerId === instrument.id) this.sampler = sampler; resolve() },
            // Offline or blocked: keep playing the synth version of the sound.
            onerror: () => { if (this.samplerId === instrument.id) this.samplerId = undefined; sampler.dispose(); resolve() },
          }).connect(this.sampleTone)
          this.pendingSampler = sampler
        })
      } else {
        this.samplerReady = Promise.resolve()
      }
    }
    const target = this.sampler ?? this.pendingSampler
    if (instrument && target && !target.disposed) {
      target.set({ attack: Math.min(patch.attack, 0.3), release: Math.max(0.05, Math.min(patch.release, instrument.release * 2)) })
      target.volume.value = instrument.gain + patch.volume + 10
      // Synth cutoffs are low because a raw oscillator is harsh; a recording is already shaped,
      // so the same number opens the tone filter much wider. "Darker" still darkens it.
      this.sampleTone.frequency.value = Math.max(400, Math.min(18000, patch.cutoff * 4))
      // Recordings like the distorted guitar already carry their own grit: add less on top.
      this.drive.distortion = patch.drive * 0.45
      this.drive.wet.value = patch.drive > 0.15 ? 1 : 0
    }
  }

  private pendingSampler?: Tone.Sampler

  /** The sound source for this moment: the recorded instrument once loaded, else the synth. */
  private get source(): Tone.PolySynth<Tone.MonoSynth> | Tone.Sampler {
    return this.sampler?.loaded ? this.sampler : this.synth
  }

  private frequencies(notes: number[]) {
    return notes.map((note) => midiToFrequency(note + this.patch.octave * 12))
  }

  play(notes: number[], duration: number, time: number, velocity: number) {
    this.source.triggerAttackRelease(this.frequencies(notes), duration, time, velocity)
  }

  /** Starts notes that keep sounding until `release` (for keys held on the keyboard). */
  press(notes: number[], velocity: number) {
    const fresh: number[] = []
    for (const note of notes) {
      const entry = this.held.get(note)
      if (entry) entry.count += 1
      else {
        const [frequency] = this.frequencies([note])
        this.held.set(note, { count: 1, frequency })
        fresh.push(frequency)
      }
    }
    if (fresh.length) this.source.triggerAttack(fresh, Tone.immediate(), velocity)
  }

  release(notes: number[]) {
    const done: number[] = []
    for (const note of notes) {
      const entry = this.held.get(note)
      if (!entry) continue
      entry.count -= 1
      if (entry.count <= 0) {
        this.held.delete(note)
        done.push(entry.frequency)
      }
    }
    if (done.length) { this.synth.triggerRelease(done, Tone.immediate()); this.sampler?.triggerRelease(done, Tone.immediate()) }
  }

  releaseAll() {
    this.held.clear()
    this.synth.releaseAll()
    this.sampler?.releaseAll()
  }

  dispose() {
    this.synth.dispose()
    this.sampler?.dispose()
    this.pendingSampler?.dispose()
    this.sampleTone.dispose()
    for (const node of [this.drive, this.cabinet, this.chorus, this.delay, this.reverb, this.output]) node.dispose()
  }
}
