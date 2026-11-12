/**
 * Plays audio files through Web Audio so the visualizers can listen.
 * One <audio> element for decoding and seeking, one analyser for the pictures.
 */
export class PlayerEngine {
  readonly audio: HTMLAudioElement
  context?: AudioContext
  analyser?: AnalyserNode
  /** The node visualizers (and MilkDrop) tap into. */
  source?: MediaElementAudioSourceNode
  frequency: Uint8Array<ArrayBuffer> = new Uint8Array(1024)
  waveform: Uint8Array<ArrayBuffer> = new Uint8Array(2048)

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
  }

  /** Builds the audio graph. Browsers only allow this after a click, so call it from one. */
  ensureGraph(): AudioContext {
    if (!this.context) {
      const context = new AudioContext()
      const source = context.createMediaElementSource(this.audio)
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.72
      // A narrower window than the default makes quiet parts look quiet and hits jump out.
      analyser.minDecibels = -85
      analyser.maxDecibels = -18
      source.connect(analyser)
      analyser.connect(context.destination)
      this.context = context
      this.source = source
      this.analyser = analyser
      this.frequency = new Uint8Array(analyser.frequencyBinCount)
      this.waveform = new Uint8Array(analyser.fftSize)
    }
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  /** Reads the latest frame into `frequency` and `waveform`. */
  read() {
    if (!this.analyser) {
      this.frequency.fill(0)
      this.waveform.fill(128)
      return
    }
    this.analyser.getByteFrequencyData(this.frequency)
    this.analyser.getByteTimeDomainData(this.waveform)
  }

  get sampleRate() {
    return this.context?.sampleRate ?? 44100
  }

  dispose() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    void this.context?.close()
  }
}
