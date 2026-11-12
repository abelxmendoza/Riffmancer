/** Pure audio analysis helpers. They read the analyser's byte arrays, so they test without Web Audio. */

export interface Bands {
  /** 0..1 loudness of the low end (kick, bass), roughly 20–250 Hz. */
  bass: number
  /** 0..1 loudness of the mids (guitars, vocals), roughly 250 Hz–4 kHz. */
  mid: number
  /** 0..1 loudness of the highs (cymbals, hats), roughly 4 kHz and up. */
  treble: number
  /** 0..1 overall loudness. */
  level: number
}

const average = (data: ArrayLike<number>, from: number, to: number) => {
  const start = Math.max(0, Math.floor(from))
  const end = Math.min(data.length, Math.max(start + 1, Math.ceil(to)))
  let sum = 0
  for (let index = start; index < end; index += 1) sum += data[index]
  return sum / (end - start) / 255
}

/** Splits byte frequency data into bass, mid and treble energy. */
export function bandsFrom(frequency: ArrayLike<number>, sampleRate: number): Bands {
  const binHz = sampleRate / 2 / Math.max(1, frequency.length)
  const bin = (hz: number) => hz / binHz
  return {
    bass: average(frequency, bin(20), bin(250)),
    mid: average(frequency, bin(250), bin(4000)),
    treble: average(frequency, bin(4000), bin(16000)),
    level: average(frequency, 0, frequency.length),
  }
}

/**
 * Spreads linear FFT bins over `count` bars on a log scale, so the low end (where the riffs live)
 * gets most of the screen instead of a sliver on the left.
 */
export function logBars(frequency: ArrayLike<number>, count: number, sampleRate: number, minHz = 30, maxHz = 16000): number[] {
  const binHz = sampleRate / 2 / Math.max(1, frequency.length)
  const bars: number[] = []
  const ratio = maxHz / minHz
  for (let index = 0; index < count; index += 1) {
    const lo = minHz * ratio ** (index / count)
    const hi = minHz * ratio ** ((index + 1) / count)
    const value = average(frequency, lo / binHz, hi / binHz)
    // Highs are quieter in real music; tilt them up a little so the right side still dances.
    const tilt = 1 + (index / count) * 0.35
    bars.push(Math.min(1, value * tilt))
  }
  return bars
}

/**
 * Detects kicks and big hits: a beat is when bass energy jumps well above its recent average.
 * Keeps a short history and a refractory period so one kick doesn't fire twice.
 */
export class BeatDetector {
  private history: number[] = []
  private lastBeat = -Infinity

  constructor(private readonly size = 43, private readonly sensitivity = 1.35, private readonly cooldownMs = 180) {}

  /** Feed one frame. Returns true on the frame a beat lands. */
  update(bass: number, nowMs: number): boolean {
    const mean = this.history.length ? this.history.reduce((sum, value) => sum + value, 0) / this.history.length : 0
    this.history.push(bass)
    if (this.history.length > this.size) this.history.shift()
    if (this.history.length < 8) return false
    const isBeat = bass > 0.18 && bass > mean * this.sensitivity && nowMs - this.lastBeat > this.cooldownMs
    if (isBeat) this.lastBeat = nowMs
    return isBeat
  }

  reset() {
    this.history = []
    this.lastBeat = -Infinity
  }
}

/** Moves `current` toward `target`, fast on the way up and slower on the way down (like a VU meter). */
export function smooth(current: number, target: number, attack = 0.6, release = 0.12) {
  return current + (target - current) * (target > current ? attack : release)
}
