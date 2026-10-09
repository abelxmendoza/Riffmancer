import { describe, expect, it } from 'vitest'
import { resolveStemGain, SharedTransportClock, type StemControls } from './SharedStemTransport'

const controls = (): StemControls => ({
  vocals: { muted: false, soloed: false, volume: 0.8 },
  drums: { muted: false, soloed: false, volume: 0.7 },
  bass: { muted: false, soloed: false, volume: 0.6 },
  other: { muted: false, soloed: false, volume: 0.5 },
})

describe('stem mix routing', () => {
  it('supports mute and multiple solos without leaking other tracks', () => {
    const state = controls()
    state.bass.muted = true
    expect(resolveStemGain('bass', state)).toBe(0)
    expect(resolveStemGain('vocals', state)).toBe(0.8)

    state.vocals.soloed = true
    state.drums.soloed = true
    expect(resolveStemGain('vocals', state)).toBe(0.8)
    expect(resolveStemGain('drums', state)).toBe(0.7)
    expect(resolveStemGain('bass', state)).toBe(0)
    expect(resolveStemGain('other', state)).toBe(0)
  })
})

describe('shared transport clock', () => {
  it('keeps one position across play, pause, and seek', () => {
    const clock = new SharedTransportClock(120)
    clock.play(10)
    expect(clock.position(15)).toBe(5)
    clock.seek(42, 15)
    expect(clock.position(18)).toBe(45)
    clock.pause(18)
    expect(clock.position(99)).toBe(45)
    clock.seek(300, 99)
    expect(clock.position(99)).toBe(120)
  })
})
