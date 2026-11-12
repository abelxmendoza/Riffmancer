import { DELAY_LABELS, NATURAL, type DelayTime, type VocalChain } from '../presets'
import { sanitizeChain } from '../vocalSound'

/**
 * Listens to a reference song and estimates the effects on its voice: how much reverb and how
 * long, echo and its timing, brightness, grit, width, how squashed it is, and whether it is
 * band-limited like a phone. Runs in the browser on raw samples, no network.
 *
 * These are estimates. On a full mix the instruments colour every reading, so each trait says
 * how sure it is, and the result is a starting point the person can tweak.
 */

export type Confidence = 'low' | 'medium' | 'high'

export interface Trait {
  id: 'reverb' | 'echo' | 'brightness' | 'grit' | 'width' | 'compression' | 'band'
  label: string
  /** Plain-word reading, e.g. "long, about 3.2 s". */
  reading: string
  confidence: Confidence
}

export interface VocalMatch {
  chain: VocalChain
  traits: Trait[]
  /** Short description for the preset, e.g. "lots of reverb, slapback echo, bright". */
  description: string
  /** Seconds of audio analysed. */
  seconds: number
  bpm?: number
}

export interface AudioInput {
  sampleRate: number
  /** One or two channels. */
  channels: Float32Array[]
}

const MAX_SECONDS = 90
const FRAME = 0.01

// ---------- small DSP helpers ----------

/** RBJ biquad filter, applied in place on a copy. */
function biquad(input: Float32Array, sampleRate: number, type: 'highpass' | 'lowpass', frequency: number, q = Math.SQRT1_2): Float32Array {
  const w = (2 * Math.PI * frequency) / sampleRate
  const alpha = Math.sin(w) / (2 * q)
  const cos = Math.cos(w)
  const b0 = type === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2
  const b1 = type === 'lowpass' ? 1 - cos : -(1 + cos)
  const b2 = b0
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  const out = new Float32Array(input.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    out[i] = y
    x2 = x1; x1 = x; y2 = y1; y1 = y
  }
  return out
}

/** In-place radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k), wi = Math.sin(angle * k)
        const a = start + k, b = a + size / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr; im[a] += ti
      }
    }
  }
}

const db = (value: number) => 10 * Math.log10(Math.max(value, 1e-12))

function percentile(values: number[], p: number): number {
  if (!values.length) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))]
}

const median = (values: number[]) => percentile(values, 50)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const lerp = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => outMin + (clamp(value, Math.min(inMin, inMax), Math.max(inMin, inMax)) - inMin) * (outMax - outMin) / (inMax - inMin)

/** RMS energy per 10 ms frame, in dB. */
export function envelope(signal: Float32Array, sampleRate: number): number[] {
  const size = Math.max(1, Math.round(sampleRate * FRAME))
  const frames: number[] = []
  for (let start = 0; start + size <= signal.length; start += size) {
    let sum = 0
    for (let i = start; i < start + size; i++) sum += signal[i] * signal[i]
    frames.push(db(sum / size))
  }
  return frames
}

// ---------- the measurements ----------

/** attackIndex: where the note first peaks; peakIndex: where the held note lets go; endIndex: 15 dB down. */
interface Decay { peak: number; attackIndex: number; peakIndex: number; endIndex: number }

/** Places where the voice stops: a level peak followed by a drop of 15 dB or more. */
export function phraseEnds(env: number[], floor: number): Decay[] {
  const ends: Decay[] = []
  let i = 0
  while (i < env.length - 20) {
    if (env[i] < floor + 20) { i++; continue }
    // Climb to the local peak.
    let attackIndex = i
    while (attackIndex + 1 < env.length && env[attackIndex + 1] >= env[attackIndex]) attackIndex++
    const peak = env[attackIndex]
    // Walk forward while the level stays near the peak (a held note).
    let j = attackIndex
    while (j + 1 < env.length && env[j + 1] > peak - 6) j++
    // Then see whether it falls away by 15 dB within 300 ms (the voice stopped). A new attack
    // first means the line goes on: start again from there.
    let k = j
    let lowest = env[j]
    let stopped = false
    while (k + 1 < env.length && k - j < 30) {
      k++
      lowest = Math.min(lowest, env[k])
      if (env[k] <= peak - 15) { stopped = true; break }
      if (env[k] - lowest >= 4) break
    }
    // Echoes repeat the last syllable, so time them from its attack, not the start of the line.
    let lastAttack = attackIndex
    for (let t = j; t > attackIndex + 2; t--) {
      if (env[t] - env[t - 2] >= 4) {
        lastAttack = t
        while (lastAttack + 1 <= j && env[lastAttack + 1] >= env[lastAttack]) lastAttack++
        break
      }
    }
    if (stopped) ends.push({ peak, attackIndex: lastAttack, peakIndex: j, endIndex: k })
    i = Math.max(stopped ? k + 1 : k, i + 1)
  }
  return ends
}

function measureReverb(env: number[], floor: number, ends: Decay[]) {
  const slopes: number[] = []
  const tails: number[] = []
  for (const end of ends) {
    // Tail level 150–400 ms after the voice let go, relative to the peak.
    const from = end.peakIndex + 15, to = Math.min(env.length, end.peakIndex + 40)
    if (to - from < 10) continue
    const tail = env.slice(from, to)
    tails.push(tail.reduce((sum, value) => sum + value, 0) / tail.length - end.peak)
    // Decay slope (dB per second) between −10 and −35 dB below the peak, stopping at the noise floor or a new note.
    const points: [number, number][] = []
    for (let t = end.peakIndex; t < Math.min(env.length, end.peakIndex + 300); t++) {
      const level = env[t] - end.peak
      if (t > end.peakIndex + 2 && env[t] > env[t - 1] + 3) break
      if (env[t] < floor + 3) break
      if (level <= -10 && level >= -35) points.push([t * FRAME, env[t]])
    }
    if (points.length >= 5) {
      const n = points.length
      const mx = points.reduce((s, [x]) => s + x, 0) / n
      const my = points.reduce((s, [, y]) => s + y, 0) / n
      const slope = points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / points.reduce((s, [x]) => s + (x - mx) ** 2, 0)
      if (slope < 0) slopes.push(slope)
    }
  }
  const tail = median(tails)
  const slope = median(slopes)
  const decay = Number.isFinite(slope) ? clamp(60 / -slope, 0.3, 9) : undefined
  return { tail: Number.isFinite(tail) ? tail : undefined, decay, samples: Math.min(tails.length, slopes.length || tails.length) }
}

/** Echoes: a voice that stopped comes back quieter at a fixed delay, again and again. */
export function measureEcho(env: number[], ends: Decay[]) {
  const lags: number[] = []
  const levels: number[] = []
  for (const end of ends) {
    let lowest = env[end.endIndex]
    for (let t = end.endIndex + 1; t < Math.min(env.length, end.attackIndex + 100); t++) {
      lowest = Math.min(lowest, env[t])
      const bump = env[t] - lowest
      const belowPeak = end.peak - env[t]
      // A new note as loud as this one: the gap is over.
      if (belowPeak < 5) break
      if (bump >= 4 && belowPeak >= 5 && env[t] >= env[t - 1] && (t + 1 >= env.length || env[t] >= env[t + 1])) {
        lags.push((t - end.attackIndex) * FRAME)
        levels.push(-belowPeak)
        break
      }
    }
  }
  if (lags.length < 3) return { found: false as const, samples: lags.length }
  // The most common lag (within ±20 ms) is the delay time.
  let best = { lag: 0, count: 0 }
  for (const lag of lags) {
    const count = lags.filter((other) => Math.abs(other - lag) <= 0.02).length
    if (count > best.count) best = { lag, count }
  }
  const agreeing = lags.filter((other) => Math.abs(other - best.lag) <= 0.02)
  if (best.count < 3 || best.count / ends.length < 0.25) return { found: false as const, samples: lags.length }
  const lag = agreeing.reduce((s, v) => s + v, 0) / agreeing.length
  const level = median(levels.filter((_, index) => Math.abs(lags[index] - best.lag) <= 0.02))
  return { found: true as const, lag, level, share: best.count / ends.length, samples: best.count }
}

/** Tempo from the rhythm of the whole mix (autocorrelation of onset strength, 70–180 BPM). */
function measureTempo(env: number[]): number | undefined {
  const onset = env.map((value, index) => (index ? Math.max(0, value - env[index - 1]) : 0))
  const mean = onset.reduce((s, v) => s + v, 0) / onset.length
  const centered = onset.map((value) => value - mean)
  let best = { lag: 0, score: 0 }
  for (let lag = Math.round(60 / 180 / FRAME); lag <= Math.round(60 / 70 / FRAME); lag++) {
    let score = 0
    for (let i = lag; i < centered.length; i++) score += centered[i] * centered[i - lag]
    if (score > best.score) best = { lag, score }
  }
  return best.lag ? Math.round(60 / (best.lag * FRAME)) : undefined
}

/**
 * Slapback (60–160 ms) echoes hide inside the note, so look for the whole waveform repeating a
 * fixed short time later: a peak in the signal's autocorrelation, in the presence band where
 * pitch matters less. Only loud chunks count.
 */
export function measureSlap(vocal: Float32Array, sampleRate: number): { lag: number; strength: number } | undefined {
  const factor = Math.max(1, Math.round(sampleRate / 11025))
  const rate = sampleRate / factor
  const band = biquad(biquad(vocal, sampleRate, 'highpass', 1000), sampleRate, 'lowpass', 4000)
  const small = new Float32Array(Math.floor(band.length / factor))
  for (let i = 0; i < small.length; i++) small[i] = band[i * factor]
  const chunk = 8192
  const size = 16384
  const sums = new Float64Array(size)
  const energies: number[] = []
  for (let start = 0; start + chunk <= small.length; start += chunk) {
    let energy = 0
    for (let i = start; i < start + chunk; i++) energy += small[i] * small[i]
    energies.push(energy)
  }
  const loudEnough = percentile(energies, 50)
  const re = new Float64Array(size), im = new Float64Array(size)
  let used = 0
  energies.forEach((energy, index) => {
    if (energy < loudEnough || energy === 0) return
    re.fill(0); im.fill(0)
    for (let i = 0; i < chunk; i++) re[i] = small[index * chunk + i]
    fft(re, im)
    for (let i = 0; i < size; i++) { re[i] = re[i] * re[i] + im[i] * im[i]; im[i] = 0 }
    fft(re, im)
    for (let i = 0; i < size; i++) sums[i] += re[i] / re[0]
    used++
  })
  if (used < 4) return undefined
  const at = (seconds: number) => sums[Math.round(seconds * rate)] / used
  // An echo is one narrow peak. A held pitch repeats every cycle, so its peaks have equally high
  // neighbours a few milliseconds away; rank lags by how far they stand above those neighbours.
  const neighbours = (lag: number) => {
    let highest = 0
    for (let d = 0.002; d <= 0.008; d += 1 / rate) highest = Math.max(highest, Math.abs(at(lag - d)), Math.abs(at(lag + d)))
    return highest
  }
  let best = { lag: 0, strength: 0, prominence: 0 }
  for (let lag = 0.06; lag <= 0.16; lag += 1 / rate) {
    const value = at(lag)
    if (value < 0.08) continue
    const prominence = value - neighbours(lag)
    if (prominence > best.prominence) best = { lag, strength: value, prominence }
  }
  return best.strength > 0.12 && best.prominence > best.strength * 0.5 ? { lag: best.lag, strength: best.strength } : undefined
}

function delayTimeFor(lag: number, bpm: number | undefined): DelayTime {
  if (lag < 0.16) return 'slap'
  const options: [DelayTime, number][] = [['16n', 0.25], ['8n', 0.5], ['8n.', 0.75], ['4n', 1], ['4n.', 1.5], ['2n', 2]]
  // Only trust the tempo when the echo lands within 10% of a note length at that tempo.
  const synced = bpm && options.some(([, beats]) => Math.abs(beats * (60 / bpm) - lag) / lag < 0.1)
  const beat = 60 / (synced ? bpm! : 120)
  return options.reduce((best, option) => (Math.abs(option[1] * beat - lag) < Math.abs(best[1] * beat - lag) ? option : best))[0]
}

interface Spectrum { bins: Float64Array; binHz: number }

/** Average magnitude spectrum (power) of the loud frames. */
function averageSpectrum(signal: Float32Array, sampleRate: number, env: number[], threshold: number): Spectrum {
  const size = 2048
  const bins = new Float64Array(size / 2)
  const re = new Float64Array(size), im = new Float64Array(size)
  const hop = Math.max(size, Math.floor(signal.length / 300))
  let count = 0
  for (let start = 0; start + size <= signal.length; start += hop) {
    const frame = Math.floor((start + size / 2) / (sampleRate * FRAME))
    if ((env[frame] ?? -120) < threshold) continue
    for (let i = 0; i < size; i++) {
      re[i] = signal[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)))
      im[i] = 0
    }
    fft(re, im)
    for (let i = 0; i < size / 2; i++) bins[i] += re[i] * re[i] + im[i] * im[i]
    count++
  }
  if (count) for (let i = 0; i < bins.length; i++) bins[i] /= count
  return { bins, binHz: sampleRate / size }
}

function bandPower(spectrum: Spectrum, low: number, high: number): number {
  let sum = 0
  for (let i = Math.floor(low / spectrum.binHz); i <= Math.min(spectrum.bins.length - 1, Math.ceil(high / spectrum.binHz)); i++) sum += spectrum.bins[i]
  return sum
}

/** Spectral flatness (0 = pure tones, 1 = noise) between two frequencies. */
function flatness(spectrum: Spectrum, low: number, high: number): number {
  let logSum = 0, sum = 0, n = 0
  for (let i = Math.floor(low / spectrum.binHz); i <= Math.min(spectrum.bins.length - 1, Math.ceil(high / spectrum.binHz)); i++) {
    const value = spectrum.bins[i] + 1e-20
    logSum += Math.log(value); sum += value; n++
  }
  return n ? Math.exp(logSum / n) / (sum / n) : 0
}

/** Where the top end falls away (≥ 30 dB under the 1–3 kHz level), for phone-like sounds. */
function topEnd(spectrum: Spectrum): number {
  const reference = db(bandPower(spectrum, 1000, 3000) / Math.max(1, (2000 / spectrum.binHz)))
  for (let f = 16000; f >= 2000; f -= 250) {
    const level = db(bandPower(spectrum, f - 250, f) / Math.max(1, 250 / spectrum.binHz))
    if (level > reference - 30) return f
  }
  return 2000
}

function correlation(a: Float32Array, b: Float32Array): number {
  let ab = 0, aa = 0, bb = 0
  const step = Math.max(1, Math.floor(a.length / 400000))
  for (let i = 0; i < a.length; i += step) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i] }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 1
}

// ---------- putting it together ----------

/** Estimates the vocal effects in a reference recording. */
export function analyzeVocalEffects(input: AudioInput): VocalMatch {
  const { sampleRate } = input
  const length = Math.min(input.channels[0]?.length ?? 0, Math.round(MAX_SECONDS * sampleRate))
  if (length < sampleRate * 3) throw new Error('That clip is too short. Give me at least 5 seconds with singing in it.')
  const left = input.channels[0].subarray(0, length)
  const right = (input.channels[1] ?? input.channels[0]).subarray(0, length)
  const mid = new Float32Array(length)
  for (let i = 0; i < length; i++) mid[i] = (left[i] + right[i]) / 2
  // Voices sit in the middle of the mix and between about 150 Hz and 6 kHz.
  const vocal = biquad(biquad(mid, sampleRate, 'highpass', 150), sampleRate, 'lowpass', 6000)

  const fullEnv = envelope(mid, sampleRate)
  const env = envelope(vocal, sampleRate)
  const loud = percentile(env, 95)
  if (!Number.isFinite(loud) || loud < -70) throw new Error("I couldn't hear anything in that clip.")
  const floor = Math.max(percentile(env, 10), loud - 60)
  const ends = phraseEnds(env, floor)
  const bpm = measureTempo(fullEnv)

  const traits: Trait[] = []
  const chain: Partial<VocalChain> = { ...NATURAL }
  const said: string[] = []
  const confidenceFor = (samples: number): Confidence => (samples >= 12 ? 'high' : samples >= 5 ? 'medium' : 'low')

  // Echo. A slapback is checked first: its short repeats confuse the gap reading.
  const slap = measureSlap(vocal, sampleRate)
  const echo = slap ? { found: false as const, samples: 0 } : measureEcho(env, ends)
  if (echo.found) {
    chain.delayTime = delayTimeFor(echo.lag, bpm)
    chain.delayMix = lerp(echo.level, -22, -6, 0.1, 0.45)
    chain.delayFeedback = echo.share > 0.5 ? 0.4 : 0.25
    const name = chain.delayTime === 'slap' ? 'slapback echo' : `${DELAY_LABELS[chain.delayTime]} note echo`
    traits.push({ id: 'echo', label: 'Echo', reading: `${name} (${Math.round(echo.lag * 1000)} ms)`, confidence: confidenceFor(echo.samples) })
    said.push(name)
  } else if (slap) {
    chain.delayTime = 'slap'
    chain.delayMix = lerp(slap.strength, 0.12, 0.45, 0.15, 0.35)
    chain.delayFeedback = 0.12
    traits.push({ id: 'echo', label: 'Echo', reading: `slapback echo (${Math.round(slap.lag * 1000)} ms)`, confidence: 'low' })
    said.push('slapback echo')
  } else {
    chain.delayMix = 0
    traits.push({ id: 'echo', label: 'Echo', reading: 'no clear repeats', confidence: echo.samples >= 5 ? 'medium' : 'low' })
  }

  // Reverb.
  const reverb = measureReverb(env, floor, ends)
  if (reverb.tail !== undefined) {
    // Echo tails read as room, so trust the reverb reading less when there is echo.
    chain.reverbMix = lerp(reverb.tail, -40, -12, 0.04, 0.55) * (chain.delayMix ? 0.6 : 1)
    chain.reverbDecay = reverb.decay ?? lerp(reverb.tail, -40, -12, 0.8, 4)
    chain.reverbPreDelay = chain.reverbMix > 0.3 ? 0.04 : 0.015
    const amount = chain.reverbMix < 0.1 ? 'dry' : chain.reverbMix < 0.25 ? 'some reverb' : chain.reverbMix < 0.4 ? 'lots of reverb' : 'drenched in reverb'
    traits.push({ id: 'reverb', label: 'Reverb', reading: chain.reverbMix < 0.1 ? 'dry, very little room' : `${amount}, tail about ${chain.reverbDecay.toFixed(1)} s`, confidence: confidenceFor(reverb.samples) })
    said.push(amount)
  } else {
    traits.push({ id: 'reverb', label: 'Reverb', reading: "couldn't find clear gaps between lines to measure", confidence: 'low' })
  }

  // Tone: brightness, grit and band limits.
  const spectrum = averageSpectrum(mid, sampleRate, fullEnv, percentile(fullEnv, 50))
  const presence = db(bandPower(spectrum, 1000, 4000))
  const air = db(bandPower(spectrum, 5000, 12000))
  const tilt = air - presence
  chain.high = lerp(tilt, -30, -8, -3, 5)
  const bright = tilt > -16 ? 'bright' : tilt < -24 ? 'dark' : 'balanced'
  traits.push({ id: 'brightness', label: 'Brightness', reading: bright, confidence: 'medium' })
  if (bright !== 'balanced') said.push(bright)

  const top = topEnd(spectrum)
  if (top < 5500) {
    chain.highCut = clamp(top + 500, 2500, 8000)
    chain.lowCut = 400
    chain.mid = 5
    chain.midFreq = 1600
    traits.push({ id: 'band', label: 'Band limit', reading: `cut off above about ${(top / 1000).toFixed(1)} kHz, like a phone or old radio`, confidence: 'medium' })
    said.push('telephone')
  }

  const grit = flatness(spectrum, 2500, 7000)
  const crest = db(percentile(env.map((value) => 10 ** (value / 10)), 99)) - db(percentile(env.map((value) => 10 ** (value / 10)), 60))
  const gritScore = clamp((grit - 0.12) / 0.3, 0, 1) * 0.7 + clamp((10 - crest) / 10, 0, 1) * 0.3
  chain.drive = gritScore > 0.35 ? lerp(gritScore, 0.35, 0.9, 0.15, 0.6) : 0
  chain.driveMix = chain.drive ? clamp(chain.drive + 0.15, 0, 0.8) : 0
  traits.push({ id: 'grit', label: 'Grit / distortion', reading: chain.drive ? (chain.drive > 0.4 ? 'heavy grit' : 'some grit') : 'clean', confidence: 'low' })
  if (chain.drive) said.push(chain.drive > 0.4 ? 'distorted' : 'gritty')

  // Width.
  const stereo = input.channels.length > 1
  if (stereo) {
    const corr = correlation(biquad(left, sampleRate, 'highpass', 300), biquad(right, sampleRate, 'highpass', 300))
    chain.doubler = clamp((0.92 - corr) * 1.4, 0, 0.6)
    chain.chorus = clamp((0.85 - corr) * 0.8, 0, 0.4)
    const wide = corr > 0.9 ? 'narrow, centred' : corr > 0.7 ? 'a bit wide' : 'wide, doubled or chorused'
    traits.push({ id: 'width', label: 'Width', reading: wide, confidence: 'medium' })
    if (corr <= 0.7) said.push('wide')
  } else {
    traits.push({ id: 'width', label: 'Width', reading: 'mono recording, width unknown', confidence: 'low' })
  }

  // Compression: how little the level moves while singing.
  const active = env.filter((value) => value > loud - 25)
  const range = percentile(active, 95) - percentile(active, 20)
  chain.compRatio = lerp(range, 16, 5, 2, 8)
  chain.compThreshold = lerp(range, 16, 5, -14, -26)
  chain.compAttack = range < 8 ? 0.004 : 0.01
  traits.push({ id: 'compression', label: 'Compression', reading: range < 8 ? 'heavily compressed, very even' : range < 12 ? 'compressed' : 'light, natural dynamics', confidence: active.length > 300 ? 'medium' : 'low' })
  if (range < 8) said.push('compressed')

  return {
    chain: sanitizeChain(chain),
    traits,
    description: said.length ? said.join(', ') : 'natural, light effects',
    seconds: length / sampleRate,
    bpm,
  }
}
