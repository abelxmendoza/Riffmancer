import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const postPunk: GenreDefinition = {
  id: 'post-punk',
  name: 'Post Punk',
  tagline: 'Driving drums, melodic bass up front, cold chorus guitars.',
  primary: true,
  bpm: { min: 110, max: 175, default: 142 },
  swing: 0,
  key: { root: 4, scale: 'minor' },
  progression: [1, 6, 3, 7],
  voicing: 'triad',
  drums: {
    main: {
      kick: 'X.......X.x.....',
      snare: '....X.......X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      crash: '................',
    },
    alt: {
      kick: 'X...X...X...X...',
      snare: '....X.......X...',
      tomLow: 'x.x.x.x.x.x.x.x.',
      closedHat: '..x...x...x...x.',
    },
    fill: {
      kick: 'X...............',
      snare: 'x.x.x.x.....xxXX',
      tomHigh: '........x.x.....',
      tomLow: '..........x.x...',
    },
  },
  bass: 'R.r.8.r.5.r.8.5.',
  chords: 'X-------x-------',
  sounds: {
    bass: patch('Post-punk pick bass', { wave: 'sawtooth', octave: 0, cutoff: 1800, filterEnv: 1.2, decay: 0.25, sustain: 0.5, release: 0.15, drive: 0.25, chorus: 0.4, reverb: 0.1, volume: -8 }),
    chords: patch('Cold chorus guitar', { wave: 'fattriangle', spread: 18, attack: 0.004, decay: 0.8, sustain: 0.35, release: 0.6, cutoff: 3200, filterEnv: 0.8, chorus: 0.85, delay: 0.3, reverb: 0.4, volume: -14 }),
    lead: patch('Cold wave synth', { wave: 'square', cutoff: 2600, filterEnv: 0.6, decay: 0.3, sustain: 0.5, chorus: 0.5, delay: 0.35, reverb: 0.4, volume: -14 }),
    kit: kit({ kickPitch: 34, kickDecay: 0.35, snareTone: 0.35, snareDecay: 0.2, snareBrightness: 3500, hatDecay: 0.04, room: 0.35 }),
  },
  tips: [
    'Let the bass carry the melody: play high notes on the right side of the keyboard over a held chord.',
    'Switch to beat B for the pounding floor-tom groove.',
    'Keep it cold: minor chords on degrees 1, 6, 3 and 7 are the classic sound.',
  ],
}
