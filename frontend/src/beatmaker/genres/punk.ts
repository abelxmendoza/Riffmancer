import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const punk: GenreDefinition = {
  id: 'punk',
  name: 'Punk',
  tagline: 'Fast, loud, three chords and the truth.',
  primary: true,
  bpm: { min: 140, max: 230, default: 180 },
  swing: 0,
  key: { root: 9, scale: 'major' },
  progression: [1, 4, 5, 4],
  voicing: 'power',
  drums: {
    main: {
      kick: 'X.....x.X.x.....',
      snare: '....X.......X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      crash: 'X...............',
    },
    alt: {
      kick: 'X...x...X...x...',
      snare: '..X...X...X...X.',
      openHat: 'x.x.x.x.x.x.x.x.',
      crash: 'X...............',
    },
    fill: {
      kick: 'X.......X.......',
      snare: 'x.x.x.x.xxxxXXXX',
      crash: '................',
    },
  },
  bass: 'R.r.R.r.R.r.R.r.',
  chords: 'X.x.x.x.X.x.x.x.',
  sounds: {
    bass: patch('Punk pick bass', { wave: 'sawtooth', cutoff: 1400, filterEnv: 1, decay: 0.15, sustain: 0.6, release: 0.1, drive: 0.4, reverb: 0.05, volume: -9 }),
    chords: patch('Punk crunch guitar', { wave: 'fatsawtooth', spread: 22, attack: 0.002, decay: 0.25, sustain: 0.6, release: 0.08, cutoff: 3500, filterEnv: 0.3, drive: 0.78, reverb: 0.15, volume: -16 }),
    lead: patch('Buzzsaw lead', { wave: 'fatsquare', spread: 12, cutoff: 3000, filterEnv: 0.5, decay: 0.2, sustain: 0.7, drive: 0.5, reverb: 0.2, volume: -16 }),
    kit: kit({ kickPitch: 36, kickDecay: 0.3, snareTone: 0.3, snareDecay: 0.22, snareBrightness: 4500, hatDecay: 0.06, drive: 0.1, room: 0.3 }),
  },
  tips: [
    'Degrees 1, 4 and 5 are all you need. Bash them on the left side of the keyboard.',
    'Beat B is the fast "oom-pah" skate beat. Crank the tempo.',
    'Hit Fill before the chorus for a snare roll and crash.',
  ],
}
