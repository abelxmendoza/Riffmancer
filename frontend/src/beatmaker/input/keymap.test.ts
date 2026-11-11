import { beforeEach, describe, expect, it } from 'vitest'
import { mapComputerKey, mapMidiNote, parseMidiMessage, type KeymapSettings } from './keymap'

const settings: KeymapSettings = { mode: 'band', splitNote: 60, root: 4, scale: 'minor', scaleLock: true }

describe('keyboard mapping', () => {
  it('plays chords left of the split and the synth to the right', () => {
    expect(mapMidiNote(48, 0, settings)).toEqual({ type: 'chord', degree: 1 })
    expect(mapMidiNote(57, 0, settings)).toEqual({ type: 'chord', degree: 6 })
    expect(mapMidiNote(64, 0, settings)).toEqual({ type: 'lead', midi: 64 })
  })

  it('snaps synth notes into the key unless scale lock is off', () => {
    expect(mapMidiNote(65, 0, settings)).toEqual({ type: 'lead', midi: 64 })
    expect(mapMidiNote(65, 0, { ...settings, scaleLock: false })).toEqual({ type: 'lead', midi: 65 })
  })

  it('treats MIDI channel 10 and drum mode as drums', () => {
    expect(mapMidiNote(36, 9, settings)).toEqual({ type: 'drum', voice: 'kick' })
    expect(mapMidiNote(38, 0, { ...settings, mode: 'drums' })).toEqual({ type: 'drum', voice: 'snare' })
    expect(mapMidiNote(72, 0, { ...settings, mode: 'drums' })).toEqual({ type: 'drum', voice: 'kick' })
  })

  it('maps the computer keyboard', () => {
    expect(mapComputerKey('1', settings)).toEqual({ type: 'drum', voice: 'kick' })
    expect(mapComputerKey('V', settings)).toEqual({ type: 'chord', degree: 4 })
    expect(mapComputerKey('a', settings)).toEqual({ type: 'lead', midi: 64 })
    expect(mapComputerKey('q', settings)).toBeUndefined()
  })

  it('parses raw MIDI messages', () => {
    expect(parseMidiMessage([0x90, 60, 127])).toEqual({ kind: 'noteOn', channel: 0, note: 60, velocity: 1 })
    expect(parseMidiMessage([0x99, 36, 0])).toMatchObject({ kind: 'noteOff', channel: 9 })
    expect(parseMidiMessage([0x81, 60, 64])).toMatchObject({ kind: 'noteOff', channel: 1 })
    expect(parseMidiMessage([0xb0, 1, 64]).kind).toBe('other')
  })
})
