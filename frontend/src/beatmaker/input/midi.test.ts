import { beforeEach, describe, expect, it } from 'vitest'
import { MidiInput, type MidiStatus } from './midi'

describe('MidiInput', () => {
  it('reports unsupported browsers', async () => {
    const statuses: MidiStatus[] = []
    const input = new MidiInput(() => undefined, (status) => statuses.push(status), {} as Navigator)
    await input.connect()
    expect(statuses).toEqual([{ state: 'unsupported' }])
  })

  it('listens to every connected keyboard', async () => {
    const statuses: MidiStatus[] = []
    const notes: number[] = []
    const keyboard = { id: 'k1', name: 'Launchkey 25', onmidimessage: null as null | ((event: { data: Uint8Array | null }) => void) }
    const access = { inputs: new Map([['k1', keyboard]]), onstatechange: null }
    const nav = { requestMIDIAccess: () => Promise.resolve(access) } as unknown as Navigator
    const input = new MidiInput((message) => notes.push(message.note), (status) => statuses.push(status), nav)
    await input.connect()
    expect(statuses.at(-1)).toEqual({ state: 'ready', devices: [{ id: 'k1', name: 'Launchkey 25' }] })
    keyboard.onmidimessage?.({ data: new Uint8Array([0x90, 61, 100]) })
    expect(notes).toEqual([61])
    input.disconnect()
    expect(keyboard.onmidimessage).toBeNull()
  })
})
