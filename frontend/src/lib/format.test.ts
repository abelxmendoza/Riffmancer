import { describe, expect, it } from 'vitest'
import { formatBytes, formatSampleRate, formatTime } from './format'

describe('audio formatting', () => {
  it('formats timeline positions', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(65.9)).toBe('1:05')
    expect(formatTime(Number.NaN)).toBe('0:00')
  })

  it('formats audio metadata', () => {
    expect(formatBytes(2_621_440)).toBe('2.5 MB')
    expect(formatSampleRate(44_100)).toBe('44.1 kHz')
  })
})
