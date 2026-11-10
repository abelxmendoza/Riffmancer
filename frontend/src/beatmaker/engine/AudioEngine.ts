import * as Tone from 'tone'
import type { DrumVoice, KitPatch, SynthPatch } from '../genres'
import { Conductor, quantizeStep, type BandSong, type Tick } from '../conductor'
import { DrumKit } from './DrumKit'
import { SynthChannel } from './SynthChannel'

import type { MixPart, SynthPart } from './types'

export type { MixPart, SynthPart }

/**
 * Everything that makes sound. Built on Tone.js (MIT): its Transport is the tempo clock,
 * and its synths and effects are the instruments. Musical decisions live in `Conductor`.
 */
export class AudioEngine {
  readonly conductor: Conductor
  private readonly master = new Tone.Limiter(-1)
  private readonly masterVolume = new Tone.Volume(-2)
  private readonly recorder = new Tone.Recorder()
  private readonly bandKit = new DrumKit()
  private readonly liveKit = new DrumKit()
  private readonly channels: Record<SynthPart, SynthChannel>
  private readonly liveChords: SynthChannel
  private readonly mixers: Record<MixPart, Tone.Volume>
  private repeatId?: number
  private recording = false

  private constructor(private readonly getSong: () => BandSong, patches: Record<SynthPart, SynthPatch>, private readonly onTick: (tick: Tick) => void) {
    this.conductor = new Conductor(getSong)
    this.masterVolume.chain(this.master, Tone.getDestination())
    this.master.connect(this.recorder)
    this.mixers = {
      drums: new Tone.Volume(0).connect(this.masterVolume),
      bass: new Tone.Volume(0).connect(this.masterVolume),
      chords: new Tone.Volume(0).connect(this.masterVolume),
      lead: new Tone.Volume(0).connect(this.masterVolume),
    }
    this.bandKit.output.connect(this.mixers.drums)
    this.liveKit.output.connect(this.mixers.drums)
    this.channels = {
      bass: new SynthChannel(patches.bass, 4),
      chords: new SynthChannel(patches.chords, 12),
      lead: new SynthChannel(patches.lead, 10),
    }
    this.liveChords = new SynthChannel(patches.chords, 12)
    this.channels.bass.output.connect(this.mixers.bass)
    this.channels.chords.output.connect(this.mixers.chords)
    this.liveChords.output.connect(this.mixers.chords)
    this.channels.lead.output.connect(this.mixers.lead)
  }

  /** Must be called from a click or key press: browsers only allow audio to start after a user gesture. */
  static async create(getSong: () => BandSong, patches: Record<SynthPart, SynthPatch>, kit: KitPatch, onTick: (tick: Tick) => void): Promise<AudioEngine> {
    await Tone.start()
    Tone.getContext().lookAhead = 0.05
    const engine = new AudioEngine(getSong, patches, onTick)
    engine.applyKit(kit)
    return engine
  }

  get playing() {
    return Tone.getTransport().state === 'started'
  }

  setTempo(bpm: number, swing: number) {
    const transport = Tone.getTransport()
    transport.bpm.value = bpm
    transport.swing = swing
    transport.swingSubdivision = '16n'
  }

  play() {
    const transport = Tone.getTransport()
    if (this.repeatId === undefined) {
      this.repeatId = transport.scheduleRepeat((time) => this.step(time), '16n', 0)
    }
    this.conductor.reset()
    transport.position = 0
    transport.start('+0.05')
  }

  stop() {
    const transport = Tone.getTransport()
    transport.stop()
    transport.position = 0
    this.conductor.reset()
    Object.values(this.channels).forEach((channel) => channel.releaseAll())
  }

  private step(time: number) {
    const tick = this.conductor.tick()
    const stepSeconds = Tone.Time('16n').toSeconds()
    for (const event of tick.events) {
      if (event.part === 'drums') this.bandKit.hit(event.voice, time, event.velocity)
      else {
        const length = event.part === 'chords' && event.muted ? stepSeconds * 0.45 : stepSeconds * event.steps * 0.95
        this.channels[event.part].play(event.notes, length, time, event.velocity)
      }
    }
    Tone.getDraw().schedule(() => this.onTick(tick), time)
  }

  /** The 16th-note step the player is closest to right now (used to record finger drumming). */
  currentStep(): number {
    const transport = Tone.getTransport()
    return quantizeStep(transport.getTicksAtTime(Tone.immediate()), transport.PPQ)
  }

  hitDrum(voice: DrumVoice, velocity: number) {
    this.liveKit.hit(voice, Tone.immediate(), velocity)
  }

  pressChord(notes: number[], velocity: number) {
    this.liveChords.press(notes, velocity)
  }

  releaseChord(notes: number[]) {
    this.liveChords.release(notes)
  }

  pressLead(note: number, velocity: number) {
    this.channels.lead.press([note], velocity)
  }

  releaseLead(note: number) {
    this.channels.lead.release([note])
  }

  applyPatch(part: SynthPart, patch: SynthPatch) {
    this.channels[part].applyPatch(patch)
    if (part === 'chords') this.liveChords.applyPatch(patch)
  }

  applyKit(kit: KitPatch) {
    this.bandKit.applyKit(kit)
    this.liveKit.applyKit(kit)
  }

  /** Volume 0–1 per part; 0 mutes. */
  setLevel(part: MixPart, level: number) {
    const node = this.mixers[part]
    node.mute = level <= 0
    node.volume.value = level <= 0 ? -Infinity : Tone.gainToDb(level)
  }

  setMasterLevel(level: number) {
    this.masterVolume.volume.value = level <= 0 ? -Infinity : Tone.gainToDb(level)
  }

  get isRecording() {
    return this.recording
  }

  async startRecording() {
    if (this.recording) return
    await this.recorder.start()
    this.recording = true
  }

  /** Returns the recorded audio (WebM/Opus or the browser's preferred format). */
  async stopRecording(): Promise<Blob> {
    this.recording = false
    return this.recorder.stop()
  }

  dispose() {
    this.stop()
    if (this.repeatId !== undefined) Tone.getTransport().clear(this.repeatId)
    this.bandKit.dispose()
    this.liveKit.dispose()
    Object.values(this.channels).forEach((channel) => channel.dispose())
    this.liveChords.dispose()
    Object.values(this.mixers).forEach((node) => node.dispose())
    this.master.dispose()
    this.masterVolume.dispose()
    this.recorder.dispose()
  }
}
