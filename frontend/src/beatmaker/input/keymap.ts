import type { DrumVoice } from '../genres'
import { scaleStepToMidi, snapToScale, type ScaleName } from '../theory'

/**
 * How the keyboard behaves.
 * - band: keys below the split play chords (the band follows), keys above play the synth, scale-locked.
 * - drums: every key is a drum pad.
 * - synth: every key plays the synth, scale-locked.
 */
export type KeyboardMode = 'band' | 'drums' | 'synth'

export type PlayAction =
  | { type: 'drum'; voice: DrumVoice }
  | { type: 'chord'; degree: number }
  | { type: 'lead'; midi: number }

export interface KeymapSettings {
  mode: KeyboardMode
  splitNote: number
  root: number
  scale: ScaleName
  /** When false, synth notes play exactly as pressed. */
  scaleLock: boolean
}

/** General MIDI drum notes (what most pad controllers and drum channels send). */
const GM_DRUMS: Record<number, DrumVoice> = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare',
  41: 'tomLow', 42: 'closedHat', 43: 'tomLow', 44: 'closedHat', 45: 'tomHigh',
  46: 'openHat', 47: 'tomHigh', 48: 'tomHigh', 49: 'crash', 50: 'tomHigh',
  51: 'ride', 52: 'crash', 53: 'ride', 55: 'crash', 57: 'crash', 59: 'ride',
}

/** Outside the GM range, each key of the octave maps to a pad so any keyboard can drum. */
const OCTAVE_PADS: DrumVoice[] = ['kick', 'rim', 'snare', 'clap', 'snare', 'tomLow', 'closedHat', 'tomHigh', 'closedHat', 'crash', 'openHat', 'ride']

export function drumForNote(note: number): DrumVoice {
  return GM_DRUMS[note] ?? OCTAVE_PADS[((note % 12) + 12) % 12]
}

/** White keys C D E F G A B are chord degrees 1–7; a black key repeats the degree below it. */
const DEGREE_FOR_PITCH_CLASS = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7]

export function chordDegreeForNote(note: number): number {
  return DEGREE_FOR_PITCH_CLASS[((note % 12) + 12) % 12]
}

export const MIDI_DRUM_CHANNEL = 9

export function mapMidiNote(note: number, channel: number, settings: KeymapSettings): PlayAction {
  if (channel === MIDI_DRUM_CHANNEL || settings.mode === 'drums') return { type: 'drum', voice: drumForNote(note) }
  if (settings.mode === 'band' && note < settings.splitNote) return { type: 'chord', degree: chordDegreeForNote(note) }
  const midi = settings.scaleLock ? snapToScale(note, settings.root, settings.scale) : note
  return { type: 'lead', midi }
}

/** Computer keyboard fallback for players without a MIDI keyboard plugged in. */
export const COMPUTER_DRUM_KEYS: Record<string, DrumVoice> = {
  '1': 'kick', '2': 'snare', '3': 'closedHat', '4': 'openHat', '5': 'clap', '6': 'tomHigh', '7': 'tomLow', '8': 'crash',
}
export const COMPUTER_CHORD_KEYS = ['z', 'x', 'c', 'v', 'b', 'n', 'm']
export const COMPUTER_LEAD_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"]

export function mapComputerKey(key: string, settings: KeymapSettings, leadOctave = 60): PlayAction | undefined {
  const lower = key.toLowerCase()
  const drum = COMPUTER_DRUM_KEYS[lower]
  if (drum) return { type: 'drum', voice: drum }
  const chordIndex = COMPUTER_CHORD_KEYS.indexOf(lower)
  if (chordIndex >= 0) return { type: 'chord', degree: chordIndex + 1 }
  const leadIndex = COMPUTER_LEAD_KEYS.indexOf(lower)
  if (leadIndex >= 0) return { type: 'lead', midi: scaleStepToMidi(leadIndex, settings.root, settings.scale, leadOctave) }
  return undefined
}

export interface MidiMessage {
  kind: 'noteOn' | 'noteOff' | 'other'
  channel: number
  note: number
  velocity: number
}

/** Decodes a raw Web MIDI message. A note-on with velocity 0 counts as note-off (common running-status trick). */
export function parseMidiMessage(data: ArrayLike<number>): MidiMessage {
  const status = data[0] ?? 0
  const command = status & 0xf0
  const channel = status & 0x0f
  const note = data[1] ?? 0
  const velocity = data[2] ?? 0
  if (command === 0x90 && velocity > 0) return { kind: 'noteOn', channel, note, velocity: velocity / 127 }
  if (command === 0x80 || (command === 0x90 && velocity === 0)) return { kind: 'noteOff', channel, note, velocity: 0 }
  return { kind: 'other', channel, note, velocity: 0 }
}
