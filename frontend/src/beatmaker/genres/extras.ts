import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const boomBap: GenreDefinition = {
  id: 'boom-bap',
  name: 'Boom Bap',
  tagline: 'Swung hip hop drums and dusty keys.',
  primary: false,
  bpm: { min: 80, max: 100, default: 90 },
  swing: 0.3,
  key: { root: 2, scale: 'dorian' },
  progression: [1, 4, 1, 5],
  voicing: 'seventh',
  drums: {
    main: { kick: 'X......x..X.....', snare: '....X.......X...', closedHat: 'x.x.x.x.x.x.x.x.' },
    alt: { kick: 'X.x....x..X..x..', snare: '....X.......X..o', closedHat: 'x.xxx.x.x.xxx.x.' },
    fill: { kick: 'X.........x.....', snare: '....X...x.x.xxXX' },
  },
  bass: 'R.......r.5.....',
  chords: 'X-------x-------',
  sounds: {
    bass: patch('Round bass', { wave: 'triangle', cutoff: 700, filterEnv: 0.3, sustain: 0.7, octave: -1, volume: -6 }),
    chords: patch('Dusty keys', { wave: 'triangle', decay: 0.7, sustain: 0.3, release: 0.5, cutoff: 1800, chorus: 0.3, reverb: 0.35, volume: -12 }),
    lead: patch('Soft lead', { wave: 'square', cutoff: 1600, delay: 0.3, reverb: 0.3, volume: -16 }),
    kit: kit({ kickPitch: 34, kickDecay: 0.4, snareTone: 0.3, snareDecay: 0.2, snareBrightness: 3000, room: 0.25 }),
  },
  tips: ['Swing is what makes it bounce. Try 30–40%.'],
}

export const house: GenreDefinition = {
  id: 'house',
  name: 'House',
  tagline: 'Four on the floor, offbeat hats, stabby chords.',
  primary: false,
  bpm: { min: 118, max: 130, default: 124 },
  swing: 0.1,
  key: { root: 0, scale: 'minor' },
  progression: [1, 6, 4, 5],
  voicing: 'seventh',
  drums: {
    main: { kick: 'X...X...X...X...', clap: '....X.......X...', openHat: '..x...x...x...x.' },
    alt: { kick: 'X...X...X...X...', clap: '....X.......X...', closedHat: 'xxxxxxxxxxxxxxxx', openHat: '..x...x...x...x.' },
    fill: { kick: 'X...X...X...X...', clap: '....X...x.x.xxxx' },
  },
  bass: '..R...R...R...R.',
  chords: '...x..x....x..x.',
  sounds: {
    bass: patch('House bass', { wave: 'sawtooth', cutoff: 500, filterEnv: 1.5, decay: 0.15, sustain: 0.3, octave: -1, volume: -8 }),
    chords: patch('Organ stab', { wave: 'square', decay: 0.2, sustain: 0.2, release: 0.15, cutoff: 2200, filterEnv: 1, reverb: 0.3, volume: -14 }),
    lead: patch('Piano-ish lead', { wave: 'triangle', decay: 0.5, sustain: 0.2, release: 0.4, cutoff: 4000, reverb: 0.3, volume: -12 }),
    kit: kit({ kickPitch: 32, kickDecay: 0.4, room: 0.15 }),
  },
  tips: ['Keep the kick on every beat. Change chords every bar.'],
}
