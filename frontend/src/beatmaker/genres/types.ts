import type { ChordVoicing, ScaleName } from '../theory'

export const DRUM_VOICES = ['kick', 'snare', 'clap', 'rim', 'closedHat', 'openHat', 'ride', 'crash', 'tomHigh', 'tomLow'] as const
export type DrumVoice = (typeof DRUM_VOICES)[number]

export const DRUM_LABELS: Record<DrumVoice, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  rim: 'Rim',
  closedHat: 'Hi-hat',
  openHat: 'Open hat',
  ride: 'Ride',
  crash: 'Crash',
  tomHigh: 'High tom',
  tomLow: 'Floor tom',
}

/**
 * A drum pattern written as one 16-character string per drum (one character per 16th note).
 * `X` = accent, `x` = normal hit, `o` = ghost note, `.` = rest.
 */
export type DrumPatternText = Partial<Record<DrumVoice, string>>

export type SynthWave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'fatsawtooth' | 'fatsquare' | 'fattriangle'

/** Everything the synthesizer needs to make one sound. Shared by bass, chords, and the playable lead. */
export interface SynthPatch {
  name: string
  wave: SynthWave
  /** Detune spread in cents for the "fat" waves (several stacked oscillators). */
  spread: number
  /** Shifts every note by whole octaves. */
  octave: number
  attack: number
  decay: number
  sustain: number
  release: number
  /** Low-pass filter cutoff in Hz. Lower is darker. */
  cutoff: number
  resonance: number
  /** How many octaves the filter opens when a note starts (the "pluck" or "wah"). */
  filterEnv: number
  filterDecay: number
  /** 0–1 amounts for the effect rack. */
  drive: number
  chorus: number
  delay: number
  reverb: number
  /** Seconds to slide between notes (0 = no slide). */
  glide: number
  /** Output level in decibels. */
  volume: number
}

export interface KitPatch {
  kickPitch: number
  kickDecay: number
  kickPunch: number
  snareTone: number
  snareDecay: number
  snareBrightness: number
  hatDecay: number
  drive: number
  room: number
  volume: number
}

export interface GenreDefinition {
  id: string
  name: string
  tagline: string
  /** Primary genres are shown first and get the most tuning. */
  primary: boolean
  bpm: { min: number; max: number; default: number }
  /** 0 = straight, 0.5 = heavy shuffle. */
  swing: number
  key: { root: number; scale: ScaleName }
  /** One chord per bar, as scale degrees 1–7. */
  progression: number[]
  voicing: ChordVoicing
  drums: { main: DrumPatternText; alt: DrumPatternText; fill: DrumPatternText }
  /**
   * Bass line relative to the current chord, 16 characters.
   * `R` root (accent), `r` soft root, `3` third, `5` fifth, `7` seventh, `8` octave up, `-` hold, `.` rest.
   */
  bass: string
  /** Chord rhythm, 16 characters. `X` accent, `x` hit, `m` palm-muted chug, `-` hold, `.` rest. */
  chords: string
  sounds: { bass: SynthPatch; chords: SynthPatch; lead: SynthPatch; kit: KitPatch }
  tips: string[]
}
