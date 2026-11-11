import type * as Tone from 'tone'

/**
 * Sample-accurate mic capture with an AudioWorklet. MediaRecorder can't tell exactly when its
 * recording started, which makes takes drift off the beat; the worklet stamps every block with the
 * audio-clock frame it was recorded at.
 */
const WORKLET_SOURCE = `
class RiffmancerCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.recording = false
    this.buffer = new Float32Array(4096)
    this.filled = 0
    this.startFrame = 0
    this.port.onmessage = (event) => {
      if (event.data === 'start') { this.recording = true; this.filled = 0 }
      if (event.data === 'stop') { this.flush(); this.recording = false; this.port.postMessage({ done: true }) }
    }
  }
  flush() {
    if (this.filled > 0) this.port.postMessage({ frame: this.startFrame, data: this.buffer.slice(0, this.filled) })
    this.filled = 0
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!this.recording || !channel) return true
    if (this.filled === 0) this.startFrame = currentFrame
    if (this.filled + channel.length > this.buffer.length) { this.flush(); this.startFrame = currentFrame }
    this.buffer.set(channel, this.filled)
    this.filled += channel.length
    return true
  }
}
registerProcessor('riffmancer-capture', RiffmancerCapture)
`

const loaded = new WeakSet<object>()

/** Loads the worklet into Tone's audio context. Bypasses Tone's own loader, which only loads one module per context. */
export async function loadCaptureWorklet(context: Tone.BaseContext) {
  const raw = context.rawContext as unknown as { audioWorklet?: { addModule: (url: string) => Promise<void> } }
  if (loaded.has(raw)) return
  if (!raw.audioWorklet) throw new Error('Recording needs a secure page (https or localhost) and a current browser.')
  const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
  try {
    await raw.audioWorklet.addModule(url)
    loaded.add(raw)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface Capture {
  /** Audio-clock frame of the first captured sample. */
  firstFrame: number
  samples: Float32Array
}

/** Wraps the capture worklet node. */
export class CaptureNode {
  readonly node: AudioWorkletNode
  private chunks: { frame: number; data: Float32Array }[] = []
  private finish?: () => void

  constructor(context: Tone.BaseContext) {
    this.node = context.createAudioWorkletNode('riffmancer-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' })
    this.node.port.onmessage = (event: MessageEvent<{ frame?: number; data?: Float32Array; done?: boolean }>) => {
      if (event.data.done) { this.finish?.(); return }
      if (event.data.data && event.data.frame !== undefined) this.chunks.push({ frame: event.data.frame, data: event.data.data })
    }
  }

  start() {
    this.chunks = []
    this.node.port.postMessage('start')
  }

  async stop(): Promise<Capture> {
    await new Promise<void>((resolve) => {
      this.finish = resolve
      this.node.port.postMessage('stop')
      // Never hang if the audio thread is gone.
      window.setTimeout(resolve, 1500)
    })
    this.finish = undefined
    if (!this.chunks.length) return { firstFrame: 0, samples: new Float32Array(0) }
    const firstFrame = this.chunks[0].frame
    const last = this.chunks[this.chunks.length - 1]
    const samples = new Float32Array(last.frame + last.data.length - firstFrame)
    for (const chunk of this.chunks) samples.set(chunk.data, chunk.frame - firstFrame)
    this.chunks = []
    return { firstFrame, samples }
  }

  dispose() {
    this.node.port.onmessage = null
    this.node.disconnect()
  }
}
