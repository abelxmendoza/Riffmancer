/**
 * Vocal and master chain presets for the Studio. Pure data: the audio engine turns a chain into
 * Tone.js effects, and the tests check every preset stays in range.
 *
 * Settings are starting points from common mixing practice for each style, not rules. Every slider
 * stays editable after a preset is loaded.
 */

export type DelayTime = 'slap' | '16n' | '8n' | '8n.' | '4n' | '4n.' | '2n'

export interface VocalChain {
  /** Noise gate. Threshold in dB; off when `gate` is false. */
  gate: boolean
  gateThreshold: number
  /** High-pass filter in Hz: removes rumble and mic thumps. */
  lowCut: number
  /** Low-pass filter in Hz: 20000 is open, low values give a lo-fi or telephone sound. */
  highCut: number
  /** Three-band EQ in dB. */
  low: number
  mid: number
  high: number
  /** Center of the mid band in Hz. */
  midFreq: number
  /** Compressor. */
  compThreshold: number
  compRatio: number
  compAttack: number
  compRelease: number
  /** De-esser strength, 0–1: compresses only the harsh "s" range. */
  deess: number
  /** Saturation / distortion amount and how much of it is blended in, 0–1. */
  drive: number
  driveMix: number
  /** Octave-down layer for screams and gutturals, 0–1. */
  octaveDown: number
  /** Automatic double-tracking, 0–1. */
  doubler: number
  /** Chorus, 0–1. */
  chorus: number
  /** Delay synced to the project tempo. */
  delayTime: DelayTime
  delayFeedback: number
  delayMix: number
  pingPong: boolean
  /** Reverb. Decay and pre-delay in seconds. */
  reverbDecay: number
  reverbPreDelay: number
  reverbMix: number
  /** Output trim in dB. */
  output: number
}

export interface VocalPreset {
  id: string
  name: string
  /** Genre id shared with the Beat Maker genres, or 'utility' for genre-free tools. */
  genre: string
  /** What part of the vocal this preset is for. */
  role: 'lead' | 'double' | 'ad-lib' | 'scream' | 'gang' | 'harmony' | 'fx'
  description: string
  tip: string
  chain: VocalChain
}

export interface MasterChain {
  /** Bus "glue" compressor. */
  glueThreshold: number
  glueRatio: number
  /** Tilt EQ in dB. */
  low: number
  high: number
  /** Limiter ceiling in dBFS. */
  ceiling: number
  /** Gain into the limiter in dB: the "loudness" knob. */
  drive: number
}

export interface MasterPreset {
  id: string
  name: string
  genre: string
  description: string
  chain: MasterChain
}

export const NATURAL: VocalChain = {
  gate: false,
  gateThreshold: -50,
  lowCut: 90,
  highCut: 20000,
  low: 0,
  mid: 0,
  high: 1.5,
  midFreq: 1500,
  compThreshold: -18,
  compRatio: 3,
  compAttack: 0.01,
  compRelease: 0.15,
  deess: 0.3,
  drive: 0,
  driveMix: 0,
  octaveDown: 0,
  doubler: 0,
  chorus: 0,
  delayTime: '8n',
  delayFeedback: 0.2,
  delayMix: 0,
  pingPong: false,
  reverbDecay: 1.6,
  reverbPreDelay: 0.02,
  reverbMix: 0.12,
  output: 0,
}

const chain = (changes: Partial<VocalChain>): VocalChain => ({ ...NATURAL, ...changes })

export const VOCAL_PRESETS: VocalPreset[] = [
  // Post punk
  {
    id: 'post-punk-baritone', name: 'Cold Baritone', genre: 'post-punk', role: 'lead',
    description: 'Deep, detached lead in a big dark room with a slapback echo.',
    tip: 'Sing a little lower and flatter than feels natural. The room does the drama.',
    chain: chain({ lowCut: 80, low: 1.5, mid: -2, midFreq: 600, high: 2, compThreshold: -20, compRatio: 4, drive: 0.15, driveMix: 0.25, chorus: 0.15, delayTime: 'slap', delayFeedback: 0.15, delayMix: 0.22, reverbDecay: 3.8, reverbPreDelay: 0.04, reverbMix: 0.32 }),
  },
  {
    id: 'post-punk-shout', name: 'Shouted Chant', genre: 'post-punk', role: 'lead',
    description: 'Mid-forward, slightly crunchy shout with a dotted-eighth echo.',
    tip: 'Back off the mic a few inches when you shout so the compressor isn\'t slammed.',
    chain: chain({ lowCut: 140, highCut: 12000, mid: 3, midFreq: 1800, compThreshold: -24, compRatio: 6, drive: 0.35, driveMix: 0.4, delayTime: '8n.', delayFeedback: 0.3, delayMix: 0.18, reverbDecay: 2.2, reverbMix: 0.2 }),
  },
  {
    id: 'post-punk-ghost', name: 'Ghost Double', genre: 'post-punk', role: 'double',
    description: 'Washed-out, chorused double that sits behind the lead.',
    tip: 'Pan it opposite a second double and keep it 6 dB under the lead.',
    chain: chain({ lowCut: 200, highCut: 9000, chorus: 0.5, doubler: 0.4, reverbDecay: 4.5, reverbMix: 0.45, output: -4 }),
  },
  // Metal
  {
    id: 'metal-clean', name: 'Clean Lead', genre: 'metal', role: 'lead',
    description: 'Big, polished clean vocal: tight compression, wide double, long hall.',
    tip: 'Record two takes of the chorus and put the second on a "Double" track.',
    chain: chain({ lowCut: 100, mid: -1.5, midFreq: 400, high: 3, compThreshold: -22, compRatio: 5, compAttack: 0.005, deess: 0.45, drive: 0.08, driveMix: 0.2, doubler: 0.3, delayTime: '4n', delayFeedback: 0.25, delayMix: 0.12, reverbDecay: 2.8, reverbMix: 0.22 }),
  },
  {
    id: 'metal-scream', name: 'Scream / Fry', genre: 'metal', role: 'scream',
    description: 'Aggressive, saturated scream with an octave-down layer for weight.',
    tip: 'Screams need air, not volume: stay close to the mic and let the gain do the work.',
    chain: chain({ gate: true, gateThreshold: -42, lowCut: 120, low: 2, mid: 4, midFreq: 2200, high: -1, compThreshold: -28, compRatio: 8, compAttack: 0.003, compRelease: 0.08, deess: 0.2, drive: 0.55, driveMix: 0.6, octaveDown: 0.3, doubler: 0.25, delayMix: 0.06, reverbDecay: 1.4, reverbMix: 0.12 }),
  },
  {
    id: 'metal-guttural', name: 'Guttural Low', genre: 'metal', role: 'scream',
    description: 'Deathcore-style low growl: heavy octave layer, dark and dry.',
    tip: 'Keep it short and punchy; long held lows turn to mud in a dense mix.',
    chain: chain({ gate: true, gateThreshold: -40, lowCut: 70, highCut: 9000, low: 4, mid: -2, midFreq: 900, compThreshold: -30, compRatio: 10, compAttack: 0.002, drive: 0.6, driveMix: 0.5, octaveDown: 0.55, reverbDecay: 1, reverbMix: 0.08 }),
  },
  // Punk
  {
    id: 'punk-raw', name: 'Raw Snarl', genre: 'punk', role: 'lead',
    description: 'In-your-face and a little dirty, like a cranked PA in a small club.',
    tip: 'One take with energy beats five careful ones. Don\'t fix the cracks.',
    chain: chain({ lowCut: 150, highCut: 14000, mid: 4, midFreq: 2000, compThreshold: -24, compRatio: 6, drive: 0.4, driveMix: 0.45, delayTime: 'slap', delayFeedback: 0.1, delayMix: 0.15, reverbDecay: 0.9, reverbMix: 0.1 }),
  },
  {
    id: 'punk-gang', name: 'Gang Vocals', genre: 'punk', role: 'gang',
    description: 'Wide crowd shout: stack several takes on this track for "HEY!" moments.',
    tip: 'Record 3–4 takes, move around the room between them, and keep them all.',
    chain: chain({ lowCut: 200, mid: 2, midFreq: 1500, compThreshold: -26, compRatio: 6, drive: 0.25, driveMix: 0.3, doubler: 0.6, chorus: 0.3, reverbDecay: 1.6, reverbMix: 0.25, output: -2 }),
  },
  // Drum & bass
  {
    id: 'dnb-mc', name: 'MC Hype', genre: 'drum-and-bass', role: 'lead',
    description: 'Tight, bright MC vocal that cuts through a heavy bassline.',
    tip: 'Ride the rhythm of the breaks. Keep phrases short and leave gaps for the drop.',
    chain: chain({ gate: true, gateThreshold: -48, lowCut: 160, mid: 2, midFreq: 3000, high: 4, compThreshold: -26, compRatio: 6, compAttack: 0.003, deess: 0.5, drive: 0.15, driveMix: 0.25, delayTime: '8n', delayFeedback: 0.2, delayMix: 0.1, reverbDecay: 1.2, reverbMix: 0.1 }),
  },
  {
    id: 'dnb-liquid', name: 'Liquid Diva', genre: 'drum-and-bass', role: 'lead',
    description: 'Airy, soulful topline with ping-pong delays and a long shimmer tail.',
    tip: 'Long notes work here. Let the delay finish your phrases.',
    chain: chain({ lowCut: 120, high: 5, deess: 0.55, chorus: 0.2, doubler: 0.15, delayTime: '4n.', delayFeedback: 0.4, delayMix: 0.25, pingPong: true, reverbDecay: 4, reverbPreDelay: 0.05, reverbMix: 0.35 }),
  },
  // Reggaeton
  {
    id: 'reggaeton-lead', name: 'Perreo Lead', genre: 'reggaeton', role: 'lead',
    description: 'Glossy, upfront lead with quarter-note delay throws.',
    tip: 'Pitch correction is the classic sound here; it\'s on the roadmap. For now, sing it confident and close.',
    chain: chain({ lowCut: 110, low: -1, mid: -1, midFreq: 500, high: 4, compThreshold: -22, compRatio: 4, deess: 0.5, doubler: 0.15, delayTime: '4n', delayFeedback: 0.3, delayMix: 0.18, pingPong: true, reverbDecay: 1.8, reverbMix: 0.16 }),
  },
  {
    id: 'reggaeton-throw', name: 'Delay Throw', genre: 'reggaeton', role: 'ad-lib',
    description: 'Ad-libs that echo across the stereo field at the end of lines.',
    tip: 'Record single words ("dale", "yeah") on this track right at the end of phrases.',
    chain: chain({ lowCut: 250, highCut: 10000, high: 2, compThreshold: -24, compRatio: 5, delayTime: '4n.', delayFeedback: 0.5, delayMix: 0.45, pingPong: true, reverbDecay: 2.5, reverbMix: 0.25, output: -3 }),
  },
  // Secondary genres
  {
    id: 'boom-bap-rap', name: 'Boom Bap Rap', genre: 'boom-bap', role: 'lead',
    description: 'Dry, warm, upfront rap vocal with a touch of tape grit.',
    tip: 'Keep reverb almost off. The words need to be clear.',
    chain: chain({ lowCut: 100, low: 1, mid: 1.5, midFreq: 1200, high: 2, compThreshold: -24, compRatio: 5, deess: 0.45, drive: 0.12, driveMix: 0.3, delayTime: '8n', delayMix: 0.06, reverbDecay: 0.8, reverbMix: 0.06 }),
  },
  {
    id: 'house-diva', name: 'House Plate', genre: 'house', role: 'lead',
    description: 'Bright vocal on a lush plate with an eighth-note echo.',
    tip: 'Hooks repeat in house. Record the hook once and copy it across the song.',
    chain: chain({ lowCut: 120, high: 4.5, deess: 0.5, chorus: 0.2, delayTime: '8n', delayFeedback: 0.35, delayMix: 0.18, reverbDecay: 3, reverbMix: 0.3 }),
  },
  // Utility
  {
    id: 'natural', name: 'Natural', genre: 'utility', role: 'lead',
    description: 'Clean and honest: a little compression, de-essing and room.',
    tip: 'A good start for any genre. Shape it from here.',
    chain: NATURAL,
  },
  {
    id: 'harmony-pad', name: 'Harmony Stack', genre: 'utility', role: 'harmony',
    description: 'Soft, wide backing harmony that tucks under the lead.',
    tip: 'Pan harmonies left and right, and keep them quieter than the lead.',
    chain: chain({ lowCut: 220, high: 2, compThreshold: -24, compRatio: 4, deess: 0.6, doubler: 0.35, chorus: 0.35, reverbDecay: 3, reverbMix: 0.35, output: -5 }),
  },
  {
    id: 'telephone', name: 'Telephone', genre: 'utility', role: 'fx',
    description: 'Thin, boxy "through a phone" effect for intros and breakdowns.',
    tip: 'Use it for one line, then switch back. Contrast is the trick.',
    chain: chain({ lowCut: 500, highCut: 3200, mid: 6, midFreq: 1600, compThreshold: -26, compRatio: 6, drive: 0.3, driveMix: 0.4, reverbMix: 0.05 }),
  },
  {
    id: 'megaphone', name: 'Megaphone', genre: 'utility', role: 'fx',
    description: 'Distorted bullhorn shout. Great for punk and metal intros.',
    tip: 'Shout it, don\'t sing it.',
    chain: chain({ lowCut: 600, highCut: 5000, mid: 8, midFreq: 1800, compThreshold: -28, compRatio: 10, drive: 0.75, driveMix: 0.8, reverbDecay: 1, reverbMix: 0.1, output: -4 }),
  },
]

export const MASTER_PRESETS: MasterPreset[] = [
  { id: 'master-balanced', name: 'Balanced', genre: 'utility', description: 'Gentle glue and a safe ceiling.', chain: { glueThreshold: -14, glueRatio: 2, low: 0, high: 0.5, ceiling: -1, drive: 2 } },
  { id: 'master-post-punk', name: 'Post Punk Dark', genre: 'post-punk', description: 'Warm low end, softened top, moderate loudness.', chain: { glueThreshold: -16, glueRatio: 2.5, low: 1.5, high: -1, ceiling: -1, drive: 3 } },
  { id: 'master-metal', name: 'Metal Wall', genre: 'metal', description: 'Dense and loud with a tight glue.', chain: { glueThreshold: -20, glueRatio: 4, low: 1, high: 1.5, ceiling: -0.8, drive: 6 } },
  { id: 'master-punk', name: 'Punk Loud', genre: 'punk', description: 'Mid-forward and pushed hard.', chain: { glueThreshold: -18, glueRatio: 3, low: 0, high: 1, ceiling: -0.8, drive: 5 } },
  { id: 'master-dnb', name: 'DnB Club', genre: 'drum-and-bass', description: 'Big sub, crisp top, loud for the club.', chain: { glueThreshold: -18, glueRatio: 3, low: 2.5, high: 2, ceiling: -0.8, drive: 6 } },
  { id: 'master-reggaeton', name: 'Reggaeton Gloss', genre: 'reggaeton', description: 'Round low end and a polished top.', chain: { glueThreshold: -16, glueRatio: 2.5, low: 2, high: 2, ceiling: -1, drive: 4 } },
]

export function getVocalPreset(id: string): VocalPreset {
  return VOCAL_PRESETS.find((preset) => preset.id === id) ?? VOCAL_PRESETS.find((preset) => preset.id === 'natural')!
}

export function getMasterPreset(id: string): MasterPreset {
  return MASTER_PRESETS.find((preset) => preset.id === id) ?? MASTER_PRESETS[0]
}

/** Presets for a genre (lead presets first), followed by the utility presets. */
export function presetsForGenre(genre: string): VocalPreset[] {
  const own = VOCAL_PRESETS.filter((preset) => preset.genre === genre)
  return [...own, ...VOCAL_PRESETS.filter((preset) => preset.genre === 'utility')]
}

/** The preset a new vocal track gets for a genre and track role. */
export function defaultPresetFor(genre: string, role: VocalPreset['role'] = 'lead'): VocalPreset {
  const own = VOCAL_PRESETS.filter((preset) => preset.genre === genre)
  return own.find((preset) => preset.role === role) ?? own.find((preset) => preset.role === 'lead') ?? getVocalPreset('natural')
}

/** Delay length in seconds for a tempo. */
export function delaySeconds(time: DelayTime, bpm: number): number {
  const beat = 60 / bpm
  const lengths: Record<DelayTime, number> = { slap: 0.11, '16n': beat / 4, '8n': beat / 2, '8n.': beat * 0.75, '4n': beat, '4n.': beat * 1.5, '2n': beat * 2 }
  return Math.min(lengths[time], 1.9)
}

export const DELAY_LABELS: Record<DelayTime, string> = { slap: 'Slapback', '16n': '1/16', '8n': '1/8', '8n.': '1/8 dotted', '4n': '1/4', '4n.': '1/4 dotted', '2n': '1/2' }
