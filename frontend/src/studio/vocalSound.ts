import { NATURAL, type DelayTime, type VocalChain } from './presets'

/**
 * Plain words about a vocal sound ("dreamy with lots of reverb", "gritty megaphone shout",
 * "upfront and dry with a slapback") turned into a Studio vocal chain. Pure, so it is tested
 * and shared by Fret's offline brain, the style catalogue and the reference-song matcher.
 */

interface VocalWord {
  word: string
  pattern: RegExp
  change: (chain: VocalChain) => Partial<VocalChain>
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const more = (value: number, amount: number, max = 1) => clamp(Math.max(value, 0) + amount, 0, max)

const WORDS: VocalWord[] = [
  // Space.
  { word: 'huge reverb', pattern: /\b(lots of|tons of|huge|massive|big|long|cathedral|church|cave|cavernous|stadium|arena) (reverb|room|hall|space)\b|\bcathedral\b|\bdrenched\b|\bdrowned\b/, change: (c) => ({ reverbMix: more(c.reverbMix, 0.35, 0.7), reverbDecay: Math.max(c.reverbDecay, 5), reverbPreDelay: 0.06 }) },
  { word: 'reverb', pattern: /\b(reverb(y)?|hall|plate|roomy|spacious|wet)\b/, change: (c) => ({ reverbMix: more(c.reverbMix, 0.18, 0.6), reverbDecay: Math.max(c.reverbDecay, 2.6) }) },
  { word: 'dreamy', pattern: /\b(dream(y)?|ethereal|floaty|airy|angelic|washed( out)?|buried|haunting|ghostly|shoegaze)\b/, change: (c) => ({ reverbMix: more(c.reverbMix, 0.25, 0.6), reverbDecay: Math.max(c.reverbDecay, 4), chorus: more(c.chorus, 0.3), doubler: more(c.doubler, 0.2), high: Math.min(6, c.high + 2), compRatio: Math.max(c.compRatio, 3) }) },
  { word: 'dry', pattern: /\b(dry|no reverb|no effects|upfront|up front|in your face|close|intimate|tight)\b/, change: () => ({ reverbMix: 0.04, reverbDecay: 0.8, delayMix: 0 }) },
  // Echo.
  { word: 'slapback', pattern: /\bslap ?back\b|\bslap\b|\brockabilly\b|\belvis\b/, change: () => ({ delayTime: 'slap' as DelayTime, delayFeedback: 0.12, delayMix: 0.25 }) },
  { word: 'dotted delay', pattern: /\bdotted\b/, change: (c) => ({ delayTime: (/4n/.test(c.delayTime) ? '4n.' : '8n.') as DelayTime, delayMix: Math.max(c.delayMix, 0.18), delayFeedback: Math.max(c.delayFeedback, 0.3) }) },
  { word: 'delay throws', pattern: /\bthrows?\b|\bping[ -]?pong\b|\bbouncing (echo|delay)\b/, change: (c) => ({ pingPong: true, delayTime: c.delayTime === 'slap' ? '4n' : c.delayTime, delayMix: Math.max(c.delayMix, 0.3), delayFeedback: Math.max(c.delayFeedback, 0.4) }) },
  { word: 'echo', pattern: /\b(echo(es|ey|y)?|delay(ed|s)?|dub(by)?|repeats?)\b/, change: (c) => ({ delayMix: more(c.delayMix, 0.2, 0.5), delayFeedback: Math.max(c.delayFeedback, 0.35), delayTime: (c.delayTime === 'slap' ? '8n' : c.delayTime) as DelayTime }) },
  // Character.
  { word: 'distorted', pattern: /\b(distort(ed|ion)?|gritt?y|dirty|crunch(y)?|fuzz(y)?|saturated|overdriven|blown[ -]?out|raspy|screamy|harsh|nasty)\b/, change: (c) => ({ drive: more(c.drive, 0.35), driveMix: more(c.driveMix, 0.35), mid: Math.min(8, c.mid + 2), midFreq: 2000 }) },
  { word: 'megaphone', pattern: /\b(megaphone|bullhorn|loudspeaker)\b/, change: () => ({ lowCut: 600, highCut: 5000, mid: 8, midFreq: 1800, drive: 0.7, driveMix: 0.75, compRatio: 10, compThreshold: -28 }) },
  { word: 'telephone', pattern: /\b(telephone|phone|radio|walkie|old record|gramophone|lo-?fi|vintage|tinny)\b/, change: (c) => ({ lowCut: 450, highCut: 3500, mid: Math.min(8, c.mid + 5), midFreq: 1600, drive: more(c.drive, 0.2), driveMix: more(c.driveMix, 0.3) }) },
  { word: 'bright', pattern: /\b(bright(er)?|crisp(y|er)?|shiny|glossy|polished|pop|sparkl(y|ing)|clear(er)?)\b/, change: (c) => ({ high: Math.min(7, c.high + 3), deess: Math.max(c.deess, 0.5), lowCut: Math.max(c.lowCut, 110) }) },
  { word: 'dark', pattern: /\b(dark(er)?|warm(er)?|muffled|mellow|smooth(er)?|round(er)?|velvet(y)?)\b/, change: (c) => ({ high: Math.max(-6, c.high - 3), highCut: Math.min(c.highCut, 9000), low: Math.min(5, c.low + 1.5) }) },
  { word: 'deep', pattern: /\b(deep(er)?|low(er)?|demonic|monster|beast(ly)?|guttural|evil|octave (down|lower))\b/, change: (c) => ({ octaveDown: more(c.octaveDown, 0.4), low: Math.min(6, c.low + 2) }) },
  { word: 'thin', pattern: /\b(thin(ner)?|small(er)?|boxy|nasal)\b/, change: (c) => ({ lowCut: Math.max(c.lowCut, 300), low: Math.max(-6, c.low - 3) }) },
  // Width.
  { word: 'doubled', pattern: /\b(doubl(ed|e|ing)|stack(ed|s)?|layered|thick(er)?|fat(ter)?|full(er)?|choir|gang)\b/, change: (c) => ({ doubler: more(c.doubler, 0.35), chorus: more(c.chorus, 0.1) }) },
  { word: 'wide', pattern: /\b(wide(r)?|stereo|chorus(ed|y)?|lush|shimmer(y|ing)?|wobbly|warbl(y|ing))\b/, change: (c) => ({ chorus: more(c.chorus, 0.35), doubler: more(c.doubler, 0.15) }) },
  // Dynamics.
  { word: 'compressed', pattern: /\b(compress(ed|ion)?|squash(ed)?|punch(y)?|aggressive|shout(ed|y|ing)?|loud|radio[ -]?ready|in the mix|consistent|controlled|rap|rapping|spitting)\b/, change: (c) => ({ compThreshold: Math.min(c.compThreshold, -24), compRatio: Math.max(c.compRatio, 6), compAttack: 0.004, mid: Math.min(8, c.mid + 1) }) },
  { word: 'gentle', pattern: /\b(gentle|soft(er)?|natural|whisper(y|ed|ing)?|breathy|delicate|light)\b/, change: (c) => ({ compRatio: Math.min(c.compRatio, 3), compThreshold: Math.max(c.compThreshold, -16), drive: 0, driveMix: 0, deess: Math.max(c.deess, 0.45), high: Math.min(6, c.high + 1) }) },
  { word: 'gated', pattern: /\b(gate(d)?|no (hiss|noise|bleed)|noisy room|clean up)\b/, change: () => ({ gate: true, gateThreshold: -45 }) },
  { word: 'clean', pattern: /\b(clean(er)?|no distortion|undistorted|pure)\b/, change: () => ({ drive: 0, driveMix: 0, octaveDown: 0 }) },
]

/** Things people ask for that the Studio can't do yet, so Fret can say so instead of guessing. */
const UNSUPPORTED: [RegExp, string][] = [
  [/\bauto ?-?tune\b|\bpitch (correct|fix)|\bt-?pain\b|\bmelodyne\b/, 'pitch correction (auto-tune)'],
  [/\bvocoder\b|\brobot(ic)?\b|\btalk ?box\b/, 'a vocoder or robot voice'],
  [/\breverse(d)? (reverb|vocal)\b/, 'reverse reverb'],
  [/\bpitch(ed)? up\b|\bchipmunk\b|\bnightcore\b/, 'pitching the voice up'],
]

export interface VocalDescription {
  chain: VocalChain
  /** Describing words understood, in order. */
  words: string[]
  /** Effects asked for that the Studio doesn't have yet. */
  missing: string[]
}

/** Builds a vocal chain from a description, starting from `base` (a natural chain by default). */
export function describeVocal(input: string, base: VocalChain = NATURAL): VocalDescription {
  const text = input.toLowerCase()
  let chain: VocalChain = { ...base }
  const words: string[] = []
  for (const entry of WORDS) {
    if (!entry.pattern.test(text)) continue
    // "lots of reverb" already covers "reverb".
    if (entry.word === 'reverb' && words.includes('huge reverb')) continue
    if (entry.word === 'echo' && (words.includes('slapback') || words.includes('dotted delay') || words.includes('delay throws'))) continue
    chain = { ...chain, ...entry.change(chain) }
    words.push(entry.word)
  }
  const missing = UNSUPPORTED.filter(([pattern]) => pattern.test(text)).map(([, name]) => name)
  return { chain: sanitizeChain(chain), words, missing }
}

const DELAY_TIMES: DelayTime[] = ['slap', '16n', '8n', '8n.', '4n', '4n.', '2n']

/** Keeps every number in a safe range, whatever wrote the chain (a description, the AI, an analysis). */
export function sanitizeChain(input: Partial<VocalChain>, base: VocalChain = NATURAL): VocalChain {
  const num = (value: unknown, fallback: number, min: number, max: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback)
  const c = { ...base, ...input }
  return {
    gate: Boolean(c.gate),
    gateThreshold: num(c.gateThreshold, base.gateThreshold, -80, -20),
    lowCut: num(c.lowCut, base.lowCut, 20, 800),
    highCut: num(c.highCut, base.highCut, 2000, 20000),
    low: num(c.low, base.low, -12, 12),
    mid: num(c.mid, base.mid, -12, 12),
    high: num(c.high, base.high, -12, 12),
    midFreq: num(c.midFreq, base.midFreq, 200, 6000),
    compThreshold: num(c.compThreshold, base.compThreshold, -40, 0),
    compRatio: num(c.compRatio, base.compRatio, 1, 20),
    compAttack: num(c.compAttack, base.compAttack, 0.001, 0.1),
    compRelease: num(c.compRelease, base.compRelease, 0.02, 1),
    deess: num(c.deess, base.deess, 0, 1),
    drive: num(c.drive, base.drive, 0, 1),
    driveMix: num(c.driveMix, base.driveMix, 0, 1),
    octaveDown: num(c.octaveDown, base.octaveDown, 0, 1),
    doubler: num(c.doubler, base.doubler, 0, 1),
    chorus: num(c.chorus, base.chorus, 0, 1),
    delayTime: DELAY_TIMES.includes(c.delayTime) ? c.delayTime : base.delayTime,
    delayFeedback: num(c.delayFeedback, base.delayFeedback, 0, 0.85),
    delayMix: num(c.delayMix, base.delayMix, 0, 1),
    pingPong: Boolean(c.pingPong),
    reverbDecay: num(c.reverbDecay, base.reverbDecay, 0.2, 10),
    reverbPreDelay: num(c.reverbPreDelay, base.reverbPreDelay, 0, 0.2),
    reverbMix: num(c.reverbMix, base.reverbMix, 0, 1),
    output: num(c.output, base.output, -24, 12),
  }
}

/** A short, readable name from the words understood: "Dreamy wide vocal". */
export function vocalName(words: string[]): string {
  const label = [...words.slice(0, 3), 'vocal'].join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** True when the text talks about how a voice should sound. */
export function describesVocal(input: string): boolean {
  return describeVocal(input).words.length > 0
}
