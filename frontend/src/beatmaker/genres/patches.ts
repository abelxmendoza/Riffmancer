import type { KitPatch, SynthPatch } from './types'

export const DEFAULT_PATCH: SynthPatch = {
  name: 'Init',
  wave: 'sawtooth',
  spread: 20,
  octave: 0,
  attack: 0.005,
  decay: 0.2,
  sustain: 0.6,
  release: 0.3,
  cutoff: 2400,
  resonance: 1,
  filterEnv: 1.5,
  filterDecay: 0.25,
  drive: 0,
  chorus: 0,
  delay: 0,
  reverb: 0.15,
  glide: 0,
  volume: -10,
}

export const DEFAULT_KIT: KitPatch = {
  kickPitch: 32,
  kickDecay: 0.45,
  kickPunch: 0.5,
  snareTone: 0.4,
  snareDecay: 0.18,
  snareBrightness: 4000,
  hatDecay: 0.05,
  drive: 0,
  room: 0.15,
  volume: -4,
}

export const patch = (name: string, overrides: Partial<SynthPatch>): SynthPatch => ({ ...DEFAULT_PATCH, ...overrides, name })
export const kit = (overrides: Partial<KitPatch>): KitPatch => ({ ...DEFAULT_KIT, ...overrides })

/**
 * Extra synthesizer presets anyone can pick in the synth panel, regardless of genre.
 * Genre sounds are added to this list automatically.
 */
export const EXTRA_PATCHES: SynthPatch[] = [
  patch('Classic saw lead', { wave: 'sawtooth', cutoff: 3200, filterEnv: 1, delay: 0.25, reverb: 0.2, glide: 0.02 }),
  patch('Square bleep', { wave: 'square', cutoff: 5000, filterEnv: 0, decay: 0.1, sustain: 0.3, delay: 0.3, volume: -14 }),
  patch('Warm pad', { wave: 'fatsawtooth', spread: 30, attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.6, cutoff: 1400, filterEnv: 0.5, chorus: 0.5, reverb: 0.6, volume: -16 }),
  patch('Acid squelch', { wave: 'sawtooth', cutoff: 400, resonance: 12, filterEnv: 4, filterDecay: 0.15, decay: 0.15, sustain: 0.4, drive: 0.3, delay: 0.2, glide: 0.05, volume: -12 }),
  patch('Sub sine', { wave: 'sine', cutoff: 800, filterEnv: 0, sustain: 0.9, release: 0.2, octave: -1, reverb: 0, volume: -6 }),
  patch('Glass keys', { wave: 'triangle', attack: 0.002, decay: 0.6, sustain: 0.2, release: 0.8, cutoff: 6000, filterEnv: 0, chorus: 0.3, delay: 0.3, reverb: 0.45, volume: -10 }),
]
