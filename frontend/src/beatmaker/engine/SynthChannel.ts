import * as Tone from 'tone'
import type { SynthPatch } from '../genres'
import { midiToFrequency } from '../theory'

/**
 * One polyphonic synthesizer with its own effect rack:
 * oscillator → filter (with envelope) → drive → chorus → delay → reverb → volume.
 * Used for the bass, the chord instrument, and the playable lead synth.
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
  private readonly held = new Map<number, number>()

  constructor(patch: SynthPatch, voices = 8) {
    this.patch = patch
    this.synth = new Tone.PolySynth(Tone.MonoSynth, { maxPolyphony: voices } as never)
    this.synth.chain(this.drive, this.cabinet, this.chorus, this.delay, this.reverb, this.output)
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
  }

  private frequencies(notes: number[]) {
    return notes.map((note) => midiToFrequency(note + this.patch.octave * 12))
  }

  play(notes: number[], duration: number, time: number, velocity: number) {
    this.synth.triggerAttackRelease(this.frequencies(notes), duration, time, velocity)
  }

  /** Starts notes that keep sounding until `release` (for keys held on the keyboard). */
  press(notes: number[], velocity: number) {
    const fresh = notes.filter((note) => {
      const count = this.held.get(note) ?? 0
      this.held.set(note, count + 1)
      return count === 0
    })
    if (fresh.length) this.synth.triggerAttack(this.frequencies(fresh), Tone.immediate(), velocity)
  }

  release(notes: number[]) {
    const done = notes.filter((note) => {
      const count = (this.held.get(note) ?? 0) - 1
      if (count <= 0) this.held.delete(note)
      else this.held.set(note, count)
      return count <= 0
    })
    if (done.length) this.synth.triggerRelease(this.frequencies(done), Tone.immediate())
  }

  releaseAll() {
    this.held.clear()
    this.synth.releaseAll()
  }

  dispose() {
    this.synth.dispose()
    for (const node of [this.drive, this.cabinet, this.chorus, this.delay, this.reverb, this.output]) node.dispose()
  }
}
