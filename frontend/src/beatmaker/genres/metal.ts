import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const metal: GenreDefinition = {
  id: 'metal',
  name: 'Metal',
  tagline: 'Galloping double kick, palm-muted power chords, big drive.',
  primary: true,
  bpm: { min: 90, max: 200, default: 150 },
  swing: 0,
  key: { root: 4, scale: 'phrygian' },
  progression: [1, 1, 2, 7],
  voicing: 'power',
  drums: {
    main: {
      kick: 'X.xxX.xxX.xxX.xx',
      snare: '....X.......X...',
      ride: 'x...x...x...x...',
      crash: 'X...............',
    },
    alt: {
      kick: 'XxxxXxxxXxxxXxxx',
      snare: '....X.......X...',
      crash: 'X.......x.......',
      closedHat: '..x...x...x...x.',
    },
    fill: {
      kick: 'X.x.x.x.xxxxxxxx',
      tomHigh: 'x.x.x.x.........',
      tomLow: '........x.x.x.x.',
      snare: '............XXXX',
    },
  },
  bass: 'R.RRR.RRR.RRR.RR',
  chords: 'X.mmX.mmX.mmX.mm',
  sounds: {
    bass: patch('Distorted bass', { wave: 'sawtooth', octave: 0, cutoff: 900, filterEnv: 0.6, decay: 0.15, sustain: 0.6, release: 0.08, drive: 0.6, reverb: 0, volume: -9 }),
    chords: patch('Metal rhythm guitar', { wave: 'fatsawtooth', spread: 14, attack: 0.002, decay: 0.3, sustain: 0.7, release: 0.06, cutoff: 3000, resonance: 2, filterEnv: 0.4, drive: 0.92, reverb: 0.12, volume: -16 }),
    lead: patch('Shred lead', { wave: 'fatsawtooth', spread: 10, attack: 0.004, decay: 0.2, sustain: 0.8, release: 0.25, cutoff: 3600, filterEnv: 0.5, drive: 0.85, delay: 0.35, reverb: 0.3, glide: 0.03, volume: -17 }),
    kit: kit({ kickPitch: 40, kickDecay: 0.18, kickPunch: 1, snareTone: 0.5, snareDecay: 0.15, snareBrightness: 5000, hatDecay: 0.04, drive: 0.15, room: 0.2 }),
  },
  tips: [
    'Hold one low chord key and let the gallop chug. Change chords every bar for riffs.',
    'Beat B is a double-kick assault. Push the tempo past 170 for thrash.',
    'Phrygian gives that dark half-step crunch: degree 2 is the evil chord.',
  ],
}
