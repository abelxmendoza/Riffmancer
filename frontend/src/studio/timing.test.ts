import { describe, expect, it } from 'vitest'
import { barBeat, clock, computePeaks, estimateLatencyMs, peakDb, snapToBeat, splitPasses, takeStartSample } from './timing'

describe('studio timing', () => {
  it('snaps to beats', () => {
    expect(snapToBeat(0.74, 120)).toBeCloseTo(0.5)
    expect(snapToBeat(0.76, 120)).toBeCloseTo(1)
    expect(snapToBeat(0.74, 120, false)).toBeCloseTo(0.74)
    expect(snapToBeat(-3, 120)).toBe(0)
  })

  it('labels bars and beats', () => {
    expect(barBeat(0, 120)).toBe('1.1')
    expect(barBeat(2.5, 120)).toBe('2.2')
    expect(clock(65.25)).toBe('1:05.3')
  })

  it('finds the take start after the count-in, shifted by latency', () => {
    // Capture starts at t=10, song reaches the record point at t=12 (2 s count-in), 20 ms latency.
    expect(takeStartSample(10, 12, 20, 48000)).toBe(Math.round(2.02 * 48000))
    expect(takeStartSample(10, 9, 0, 48000)).toBe(0)
  })

  it('splits a cycle recording into passes and drops a short tail', () => {
    expect(splitPasses(950, 400)).toEqual([[0, 400], [400, 800]])
    expect(splitPasses(1100, 400)).toEqual([[0, 400], [400, 800], [800, 1100]])
    expect(splitPasses(300, 400)).toEqual([[0, 300]])
    expect(splitPasses(0, 400)).toEqual([])
  })

  it('computes waveform peaks and levels', () => {
    const samples = new Float32Array([0, 0.5, -0.25, 1, -1, 0])
    expect(Array.from(computePeaks(samples, 2))).toEqual([-0.25, 0.5, -1, 1])
    expect(peakDb(new Float32Array([0.5]))).toBeCloseTo(-6.02, 1)
    expect(peakDb(new Float32Array(4))).toBe(-Infinity)
  })

  it('estimates latency within limits', () => {
    expect(estimateLatencyMs(0.01, 0.02)).toBe(50)
    expect(estimateLatencyMs(5, 5)).toBe(400)
  })
})
