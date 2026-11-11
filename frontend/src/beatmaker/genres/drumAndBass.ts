import { kit, patch } from './patches'
import type { GenreDefinition } from './types'

export const drumAndBass: GenreDefinition = {
  id: 'drum-and-bass',
  name: 'Drum & Bass',
  tagline: 'Two-step breaks at 174, rolling Reese bass, lush pads.',
  primary: true,
  bpm: { min: 160, max: 180, default: 174 },
  swing: 0,
  key: { root: 5, scale: 'minor' },
  progression: [1, 1, 6, 7],
  voicing: 'seventh',
  drums: {
    main: {
      kick: 'X.........X.....',
      snare: '....X..o.o..X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      ride: '..x...x...x...x.',
    },
    alt: {
      kick: 'X.x.......xx....',
      snare: '....X..o.o..X..o',
      closedHat: 'xxx.xxx.xxx.xxx.',
      openHat: '...x............',
    },
    fill: {
      kick: 'X.........X.....',
      snare: 'x.x.x.x.xxxxXXXX',
      closedHat: 'x.x.x.x.........',
    },
  },
  bass: 'R-------.....R--',
  chords: 'X---------------',
  sounds: {
    bass: patch('Reese bass', { wave: 'fatsawtooth', spread: 35, octave: -1, attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.2, cutoff: 600, resonance: 2, filterEnv: 0.6, drive: 0.35, chorus: 0.2, glide: 0.06, volume: -10 }),
    chords: patch('Liquid pad', { wave: 'fatsawtooth', spread: 30, attack: 0.5, decay: 1, sustain: 0.7, release: 1.5, cutoff: 1600, filterEnv: 0.4, chorus: 0.6, delay: 0.2, reverb: 0.65, volume: -20 }),
    lead: patch('Neuro stab', { wave: 'square', attack: 0.002, decay: 0.18, sustain: 0.3, release: 0.2, cutoff: 1800, resonance: 6, filterEnv: 2.5, filterDecay: 0.12, drive: 0.3, delay: 0.4, reverb: 0.3, volume: -15 }),
    kit: kit({ kickPitch: 38, kickDecay: 0.25, kickPunch: 0.8, snareTone: 0.55, snareDecay: 0.16, snareBrightness: 6000, hatDecay: 0.03, room: 0.2 }),
  },
  tips: [
    'Hold one chord for two bars. DnB is about the roll, not lots of changes.',
    'Beat B is a busier, chopped-break style groove.',
    'Ghost snares (the faint dots) make the beat roll. Click a step twice for a softer hit.',
  ],
}
