import { parseMidiMessage, type MidiMessage } from './keymap'

export interface MidiDevice {
  id: string
  name: string
}

export type MidiStatus =
  | { state: 'unsupported' }
  | { state: 'pending' }
  | { state: 'denied'; message: string }
  | { state: 'ready'; devices: MidiDevice[] }

interface MidiInputLike {
  id: string
  name?: string | null
  manufacturer?: string | null
  onmidimessage: ((event: { data: Uint8Array | null }) => void) | null
}

interface MidiAccessLike {
  inputs: { forEach(callback: (input: MidiInputLike) => void): void }
  onstatechange: (() => void) | null
}

type RequestMidi = (options?: { sysex?: boolean }) => Promise<MidiAccessLike>

/**
 * Listens to every connected MIDI keyboard through the browser's Web MIDI API
 * (Chrome, Edge, Opera, and Firefox with permission). Hot-plugging is supported.
 */
export class MidiInput {
  private access?: MidiAccessLike
  private readonly request?: RequestMidi

  constructor(
    private readonly onMessage: (message: MidiMessage, deviceId: string) => void,
    private readonly onStatus: (status: MidiStatus) => void,
    nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator,
  ) {
    const candidate = (nav as unknown as { requestMIDIAccess?: RequestMidi } | undefined)?.requestMIDIAccess
    this.request = candidate ? candidate.bind(nav) : undefined
  }

  get supported(): boolean {
    return Boolean(this.request)
  }

  async connect(): Promise<void> {
    if (!this.request) {
      this.onStatus({ state: 'unsupported' })
      return
    }
    this.onStatus({ state: 'pending' })
    try {
      this.access = await this.request({ sysex: false })
      this.access.onstatechange = () => this.bind()
      this.bind()
    } catch (reason) {
      this.onStatus({ state: 'denied', message: reason instanceof Error ? reason.message : 'MIDI access was blocked.' })
    }
  }

  private bind() {
    if (!this.access) return
    const devices: MidiDevice[] = []
    this.access.inputs.forEach((input) => {
      devices.push({ id: input.id, name: input.name || input.manufacturer || 'MIDI device' })
      input.onmidimessage = (event) => {
        if (event.data) this.onMessage(parseMidiMessage(event.data), input.id)
      }
    })
    this.onStatus({ state: 'ready', devices })
  }

  disconnect() {
    if (!this.access) return
    this.access.onstatechange = null
    this.access.inputs.forEach((input) => { input.onmidimessage = null })
    this.access = undefined
  }
}
