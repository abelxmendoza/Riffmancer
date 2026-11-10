import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const reggaeton: GenreDefinition = {
  id: 'reggaeton',
  name: 'Reggaeton',
  tagline: 'Dembow rhythm, deep 808 sub, offbeat plucks.',
  primary: true,
  bpm: { min: 85, max: 105, default: 95 },
  swing: 0,
  key: { root: 9, scale: 'minor' },
  progression: [1, 6, 3, 7],
  voicing: 'triad',
  drums: {
    main: {
      kick: 'X...X...X...X...',
      snare: '...x..x....x..x.',
      closedHat: 'o.o.o.o.o.o.o.o.',
    },
    alt: {
      kick: 'X...X...X...X...',
      clap: '...x..x....x..x.',
      rim: 'x.....x...x.....',
      closedHat: 'oxo.oxo.oxo.oxo.',
    },
    fill: {
      kick: 'X...X...X.......',
      snare: '...x..x.x.x.xxxx',
      clap: '............x.x.',
    },
  },
  bass: 'R-.R-.R.R-.R-.5.',
  chords: '..X...X...X...X.',
  sounds: {
    bass: patch('808 sub', { wave: 'sine', octave: -1, attack: 0.003, decay: 0.6, sustain: 0.6, release: 0.3, cutoff: 900, filterEnv: 0, drive: 0.25, reverb: 0, glide: 0.04, volume: -5 }),
    chords: patch('Reggaeton pluck', { wave: 'sawtooth', attack: 0.002, decay: 0.18, sustain: 0.05, release: 0.2, cutoff: 900, resonance: 3, filterEnv: 2.8, filterDecay: 0.12, delay: 0.25, reverb: 0.3, volume: -12 }),
    lead: patch('Perreo lead', { wave: 'fatsquare', spread: 15, decay: 0.3, sustain: 0.5, cutoff: 2800, filterEnv: 0.8, chorus: 0.4, delay: 0.3, reverb: 0.35, glide: 0.02, volume: -16 }),
    kit: kit({ kickPitch: 30, kickDecay: 0.5, kickPunch: 0.4, snareTone: 0.25, snareDecay: 0.12, snareBrightness: 5500, hatDecay: 0.03, room: 0.1 }),
  },
  tips: [
    'The dembow (boom-ch-boom-chick) never stops. Just change chords on the left.',
    'Beat B swaps the snare for claps and rim clicks.',
    'Minor chords 1, 6, 3, 7 are the classic perreo progression.',
  ],
}
