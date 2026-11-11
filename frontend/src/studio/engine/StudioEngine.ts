import * as Tone from 'tone'
import { activeTake, armedTrack, audibleTrackIds, type StudioProject, type Track } from '../project'
import type { StoredAudio } from '../storage'
import { secondsPerBar, splitPasses, takeStartSample } from '../timing'
import { CaptureNode, loadCaptureWorklet } from './capture'
import { MasterBus, VocalChainNode } from './chain'

/**
 * Turns stored audio into an AudioBuffer. Works before audio has started (decoding doesn't need a
 * user gesture), so waveforms show as soon as the page opens.
 */
export async function decodeStored(stored: StoredAudio): Promise<AudioBuffer> {
  const context = Tone.getContext()
  if (stored.kind === 'pcm') {
    const buffer = context.createBuffer(stored.channels.length, Math.max(1, stored.channels[0]?.length ?? 1), stored.sampleRate)
    stored.channels.forEach((samples, index) => buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, index))
    return buffer
  }
  return context.decodeAudioData(await stored.blob.arrayBuffer())
}

/** One track's signal path: clips → (vocal chain) → pan → fader → master. */
export class TrackGraph {
  readonly input = new Tone.Gain(1)
  readonly chain?: VocalChainNode
  private readonly panner = new Tone.Panner(0)
  private readonly fader = new Tone.Volume(0)

  constructor(track: Track, bpm: number, destination: Tone.InputNode) {
    if (track.chain) {
      this.chain = new VocalChainNode(track.chain, bpm)
      this.input.connect(this.chain.input)
      this.chain.output.connect(this.panner)
    } else {
      this.input.connect(this.panner)
    }
    this.panner.chain(this.fader, destination)
  }

  update(track: Track, bpm: number, audible: boolean) {
    if (track.chain) this.chain?.update(track.chain, bpm)
    this.panner.pan.value = track.pan
    this.fader.volume.value = track.volume
    this.fader.mute = !audible
  }

  dispose() {
    this.chain?.dispose()
    for (const node of [this.input, this.panner, this.fader]) node.dispose()
  }
}

export interface RecordingResult {
  trackId: string
  /** Timeline position the takes start at. */
  start: number
  sampleRate: number
  /** One entry per take (a loop recording gives one per pass). */
  passes: Float32Array[]
}

interface ActiveRecording {
  trackId: string
  from: number
  songStartTime: number
  latencyMs: number
  loopSeconds: number
}

type PlayerEntry = { player: Tone.Player; signature: string }

/**
 * The Studio's live audio engine, built on Tone.js (MIT). It mirrors the project: call `sync`
 * after every change. Recording captures the dry mic; effects are applied on playback so they
 * can always be changed later.
 */
export class StudioEngine {
  readonly buffers = new Map<string, Tone.ToneAudioBuffer>()
  private readonly master: MasterBus
  private readonly masterMeter = new Tone.Meter({ smoothing: 0.6 })
  private readonly micMeter = new Tone.Meter({ smoothing: 0.5 })
  private readonly click = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 }, volume: -14 }).toDestination()
  private readonly graphs = new Map<string, TrackGraph>()
  private readonly players = new Map<string, PlayerEntry>()
  private project?: StudioProject
  private clickId?: number
  private micStream?: MediaStream
  private micSource?: MediaStreamAudioSourceNode
  private readonly micGain = new Tone.Gain(1)
  private readonly monitor = new Tone.Gain(0)
  private readonly sink = new Tone.Gain(0).toDestination()
  private capture?: CaptureNode
  private monitorTarget?: string
  private recording?: ActiveRecording

  private constructor(project: StudioProject) {
    this.master = new MasterBus(project.master, project.masterVolume)
    this.master.output.connect(this.masterMeter)
    this.master.output.toDestination()
    this.micGain.connect(this.micMeter)
    this.micGain.connect(this.monitor)
  }

  /** Call from a click: browsers only start audio after a user gesture. */
  static async create(project: StudioProject): Promise<StudioEngine> {
    await Tone.start()
    Tone.getContext().lookAhead = 0.05
    const engine = new StudioEngine(project)
    engine.sync(project)
    return engine
  }

  get context() {
    return Tone.getContext()
  }

  get playing() {
    return Tone.getTransport().state === 'started'
  }

  get isRecording() {
    return Boolean(this.recording)
  }

  get position() {
    return Tone.getTransport().seconds
  }

  get micOpen() {
    return Boolean(this.micStream)
  }

  levels() {
    const db = (value: number | number[]) => (Array.isArray(value) ? Math.max(...value) : value)
    return { master: db(this.masterMeter.getValue()), mic: this.micStream ? db(this.micMeter.getValue()) : -Infinity }
  }

  addBuffer(audioId: string, buffer: AudioBuffer) {
    this.buffers.set(audioId, new Tone.ToneAudioBuffer(buffer))
    if (this.project) this.sync(this.project)
  }

  /** Brings the audio graph in line with the project. Cheap to call often. */
  sync(project: StudioProject) {
    this.project = project
    const transport = Tone.getTransport()
    transport.bpm.value = project.bpm
    transport.timeSignature = project.beatsPerBar
    transport.loop = project.loop.on && project.loop.end > project.loop.start
    transport.loopStart = project.loop.start
    transport.loopEnd = Math.max(project.loop.start + 0.1, project.loop.end)
    this.master.update(project.master, project.masterVolume)
    this.syncClick(project.metronome)

    const audible = audibleTrackIds(project)
    const ids = new Set(project.tracks.map((track) => track.id))
    for (const [id, graph] of this.graphs) {
      if (!ids.has(id)) { graph.dispose(); this.graphs.delete(id) }
    }
    const liveClips = new Set<string>()
    for (const track of project.tracks) {
      let graph = this.graphs.get(track.id)
      // A track that gained or lost its chain is rebuilt.
      if (graph && Boolean(graph.chain) !== Boolean(track.chain)) { graph.dispose(); graph = undefined }
      if (!graph) {
        graph = new TrackGraph(track, project.bpm, this.master.input)
        this.graphs.set(track.id, graph)
      }
      graph.update(track, project.bpm, audible.has(track.id))
      for (const clip of track.clips) {
        const take = activeTake(clip)
        const buffer = this.buffers.get(take.audioId)
        if (!buffer) continue
        const key = `${track.id}:${clip.id}`
        liveClips.add(key)
        const signature = `${take.audioId}|${clip.start}|${clip.offset}`
        const existing = this.players.get(key)
        if (existing?.signature === signature) continue
        existing?.player.unsync().dispose()
        const player = new Tone.Player(buffer).connect(graph.input)
        player.sync().start(clip.start, clip.offset)
        this.players.set(key, { player, signature })
      }
    }
    for (const [key, entry] of this.players) {
      if (!liveClips.has(key)) { entry.player.unsync().dispose(); this.players.delete(key) }
    }
    this.routeMonitor(project)
  }

  private syncClick(on: boolean) {
    const transport = Tone.getTransport()
    if (on && this.clickId === undefined) {
      this.clickId = transport.scheduleRepeat((time) => {
        const beats = Math.round(transport.getTicksAtTime(time) / transport.PPQ)
        this.click.triggerAttackRelease(beats % (this.project?.beatsPerBar ?? 4) === 0 ? 'C6' : 'G5', 0.03, time)
      }, '4n', 0)
    } else if (!on && this.clickId !== undefined) {
      transport.clear(this.clickId)
      this.clickId = undefined
    }
  }

  private routeMonitor(project: StudioProject) {
    const armed = armedTrack(project)
    const target = armed?.monitor ? armed.id : undefined
    if (target === this.monitorTarget) return
    this.monitor.disconnect()
    this.monitorTarget = target
    const graph = target ? this.graphs.get(target) : undefined
    if (graph) {
      this.monitor.connect(graph.input)
      this.monitor.gain.value = 1
    } else {
      this.monitor.gain.value = 0
    }
  }

  play(from: number) {
    const transport = Tone.getTransport()
    if (transport.state === 'started') transport.stop()
    transport.start('+0.05', Math.max(0, from))
  }

  stop() {
    Tone.getTransport().stop()
  }

  /** Asks for the mic with every "phone call" filter off: they wreck singing. */
  async openMic(deviceId?: string) {
    if (this.micStream) return
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser can\'t record audio. Try Chrome, Edge, Firefox or Safari on https or localhost.')
    await loadCaptureWorklet(this.context)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })
    this.micStream = stream
    this.micSource = this.context.createMediaStreamSource(stream)
    Tone.connect(this.micSource, this.micGain)
    this.capture = new CaptureNode(this.context)
    Tone.connect(this.micGain, this.capture.node)
    Tone.connect(this.capture.node, this.sink)
  }

  closeMic() {
    this.micSource?.disconnect()
    this.capture?.dispose()
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = undefined
    this.micSource = undefined
    this.capture = undefined
  }

  /**
   * Starts recording onto the armed track at `from` seconds, after a count-in. Loop recording keeps
   * cycling the loop region and returns one take per pass.
   */
  async record(project: StudioProject, from: number, deviceId?: string) {
    const track = armedTrack(project)
    if (!track) throw new Error('Arm a vocal track first (the ● button on a track).')
    await this.openMic(deviceId)
    this.sync(project)
    const transport = Tone.getTransport()
    if (transport.state === 'started') transport.stop()
    const loop = project.loop.on && project.loop.end > project.loop.start
    const start = loop ? project.loop.start : from
    const preRoll = project.countInBars * secondsPerBar(project.bpm, project.beatsPerBar)
    const now = Tone.now() + 0.1
    const songStartTime = now + preRoll
    const beat = 60 / project.bpm
    for (let index = 0; index < project.countInBars * project.beatsPerBar; index++) {
      this.click.triggerAttackRelease(index % project.beatsPerBar === 0 ? 'C6' : 'G5', 0.03, now + index * beat)
    }
    this.capture!.start()
    transport.start(songStartTime, start)
    this.recording = { trackId: track.id, from: start, songStartTime, latencyMs: project.latencyMs, loopSeconds: loop ? project.loop.end - project.loop.start : 0 }
  }

  async stopRecording(): Promise<RecordingResult | undefined> {
    const active = this.recording
    this.recording = undefined
    Tone.getTransport().stop()
    if (!active || !this.capture) return undefined
    const { firstFrame, samples } = await this.capture.stop()
    const sampleRate = this.context.sampleRate
    const startSample = takeStartSample(firstFrame / sampleRate, active.songStartTime, active.latencyMs, sampleRate)
    const take = samples.subarray(startSample)
    if (take.length < sampleRate * 0.2) return undefined
    const passes = splitPasses(take.length, Math.round(active.loopSeconds * sampleRate)).map(([from, to]) => take.slice(from, to))
    return { trackId: active.trackId, start: active.from, sampleRate, passes }
  }

  dispose() {
    this.stop()
    this.closeMic()
    if (this.clickId !== undefined) Tone.getTransport().clear(this.clickId)
    for (const entry of this.players.values()) entry.player.unsync().dispose()
    for (const graph of this.graphs.values()) graph.dispose()
    this.players.clear()
    this.graphs.clear()
    for (const node of [this.master, this.masterMeter, this.micMeter, this.click, this.micGain, this.monitor, this.sink]) node.dispose()
  }
}
