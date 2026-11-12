import { describe, expect, it } from 'vitest'
import { analyzeVocalEffects, type AudioInput } from './vocalMatch'

const RATE = 22050

const NOTES = [1, 1.122, 1.26, 1.335, 1.498, 1.26, 1.682, 1.122, 1.335, 1, 1.498, 1.888, 1.26]

/** A fake singer: lines of three short syllables (a buzzy tone with vibrato and a little breath), then a gap. */
function singer(seconds = 30): Float32Array {
  const out = new Float32Array(seconds * RATE)
  let phase = 0
  let seed = 1
  const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5 }
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE
    const inLineAt = t % 1.6
    const syllable = inLineAt % 0.22
    const sounding = inLineAt < 0.66 && syllable < 0.17
    const shape = Math.min(1, syllable / 0.01) * Math.min(1, (0.17 - syllable) / 0.02)
    const note = NOTES[Math.floor(t / 0.22) % NOTES.length]
    const freq = 196 * note * (1 + 0.012 * Math.sin(2 * Math.PI * 5.3 * t + Math.floor(t / 0.22)))
    phase += (2 * Math.PI * freq) / RATE
    let value = 0
    for (let h = 1; h <= 16; h++) value += Math.sin(phase * h) / h
    out[i] = sounding ? 0.25 * shape * (value + 0.4 * noise()) : 0
  }
  return out
}

function withReverb(dry: Float32Array, mix: number): Float32Array {
  // Schroeder-style reverb: parallel feedback combs, about a 2.5 s tail.
  const delays = [1116, 1188, 1277, 1356].map((d) => Math.round(d * RATE / 44100) * 2)
  const wet = new Float32Array(dry.length)
  for (const delay of delays) {
    const gain = 10 ** ((-3 * delay) / RATE / 2.5)
    const buffer = new Float32Array(dry.length)
    for (let i = 0; i < dry.length; i++) buffer[i] = dry[i] + (i >= delay ? gain * buffer[i - delay] : 0)
    for (let i = 0; i < dry.length; i++) wet[i] += buffer[i] / delays.length
  }
  return dry.map((value, i) => value * (1 - mix) + wet[i] * mix)
}

function withEcho(dry: Float32Array, seconds: number, level: number): Float32Array {
  const delay = Math.round(seconds * RATE)
  const out = new Float32Array(dry)
  for (let i = delay; i < out.length; i++) out[i] += level * out[i - delay]
  return out
}

function lowpass(signal: Float32Array, cutoff: number): Float32Array {
  let out = signal
  for (let pass = 0; pass < 4; pass++) {
    const a = Math.exp((-2 * Math.PI * cutoff) / RATE)
    const next = new Float32Array(out.length)
    let y = 0
    for (let i = 0; i < out.length; i++) { y = (1 - a) * out[i] + a * y; next[i] = y }
    out = next
  }
  return out
}

const mono = (signal: Float32Array): AudioInput => ({ sampleRate: RATE, channels: [signal] })
const trait = (result: ReturnType<typeof analyzeVocalEffects>, id: string) => result.traits.find((item) => item.id === id)!

describe('vocal effect matcher', () => {
  const dry = singer()

  it('hears a dry voice as dry', () => {
    const result = analyzeVocalEffects(mono(dry))
    expect(result.chain.reverbMix).toBeLessThan(0.15)
    expect(trait(result, 'echo').reading).toMatch(/no clear repeats/)
  })

  it('hears a wet voice as wet, with a longer tail', () => {
    const dryResult = analyzeVocalEffects(mono(dry))
    const wet = analyzeVocalEffects(mono(withReverb(dry, 0.6)))
    expect(wet.chain.reverbMix).toBeGreaterThan(dryResult.chain.reverbMix + 0.1)
    expect(wet.chain.reverbDecay).toBeGreaterThan(1)
    expect(wet.description).toMatch(/reverb/)
  })

  it('finds an echo and its time', () => {
    const result = analyzeVocalEffects(mono(withEcho(dry, 0.3, 0.45)))
    expect(trait(result, 'echo').reading).toMatch(/300 ms|29\d ms|31\d ms/)
    expect(result.chain.delayMix).toBeGreaterThan(0.1)
    const slap = analyzeVocalEffects(mono(withEcho(dry, 0.11, 0.45)))
    expect(slap.chain.delayTime).toBe('slap')
  })

  it('hears a phone-like band limit and a dark voice', () => {
    const muffled = analyzeVocalEffects(mono(lowpass(dry, 1800)))
    expect(muffled.chain.high).toBeLessThan(analyzeVocalEffects(mono(dry)).chain.high)
    expect(muffled.chain.highCut).toBeLessThan(9000)
  })

  it('reads width from stereo', () => {
    const narrow = analyzeVocalEffects({ sampleRate: RATE, channels: [dry, dry] })
    const shifted = new Float32Array(dry.length)
    shifted.set(dry.subarray(0, dry.length - 400), 400)
    const wide = analyzeVocalEffects({ sampleRate: RATE, channels: [dry, shifted] })
    expect(trait(narrow, 'width').reading).toMatch(/narrow/)
    expect(wide.chain.doubler).toBeGreaterThan(narrow.chain.doubler)
  })

  it('says every reading is an estimate with a confidence', () => {
    const result = analyzeVocalEffects(mono(dry))
    for (const item of result.traits) expect(['low', 'medium', 'high']).toContain(item.confidence)
    expect(() => analyzeVocalEffects(mono(new Float32Array(RATE)))).toThrow(/too short/)
    expect(() => analyzeVocalEffects(mono(new Float32Array(RATE * 10)))).toThrow(/couldn't hear/)
  })
})
