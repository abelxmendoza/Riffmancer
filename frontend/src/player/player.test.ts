import { describe, expect, it } from 'vitest'
import { BeatDetector, bandsFrom, logBars } from './analysis'
import { isAudioFile, nextIndex, previousIndex, shuffledOrder, titleFromFileName } from './playlist'
import { colorAt, getTheme } from './themes'

describe('playlist', () => {
  it('cleans up file names into titles', () => {
    expect(titleFromFileName('01 - bone_dust-final.mp3')).toBe('bone dust-final')
    expect(titleFromFileName('My Song.wav')).toBe('My Song')
  })

  it('recognises audio files', () => {
    expect(isAudioFile({ name: 'a.flac', type: '' })).toBe(true)
    expect(isAudioFile({ name: 'x', type: 'audio/mpeg' })).toBe(true)
    expect(isAudioFile({ name: 'cover.jpg', type: 'image/jpeg' })).toBe(false)
  })

  it('moves through the list with repeat modes', () => {
    expect(nextIndex(0, 3, 'off')).toBe(1)
    expect(nextIndex(2, 3, 'off')).toBeUndefined()
    expect(nextIndex(2, 3, 'all')).toBe(0)
    expect(nextIndex(1, 3, 'one')).toBe(1)
    expect(previousIndex(0, 3)).toBe(2)
  })

  it('follows a shuffled order that starts on the current song', () => {
    const order = shuffledOrder(5, 3, () => 0.5)
    expect(order[0]).toBe(3)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4])
    expect(nextIndex(order[0], 5, 'off', order)).toBe(order[1])
  })
})

describe('analysis', () => {
  const sampleRate = 44100
  const bassHeavy = new Uint8Array(1024).map((_, index) => (index < 10 ? 255 : 10))

  it('finds the bass', () => {
    const bands = bandsFrom(bassHeavy, sampleRate)
    expect(bands.bass).toBeGreaterThan(0.8)
    expect(bands.treble).toBeLessThan(0.1)
  })

  it('spreads bins over log bars, lows on the left', () => {
    const bars = logBars(bassHeavy, 32, sampleRate)
    expect(bars).toHaveLength(32)
    expect(bars[0]).toBeGreaterThan(bars[31])
  })

  it('detects a kick after quiet frames, but not twice in a row', () => {
    const detector = new BeatDetector()
    let now = 0
    for (let frame = 0; frame < 20; frame += 1) expect(detector.update(0.2, (now += 16))).toBe(false)
    expect(detector.update(0.9, (now += 16))).toBe(true)
    expect(detector.update(0.95, (now += 16))).toBe(false)
  })
})

describe('themes', () => {
  it('falls back to the default theme and picks gradient colours', () => {
    expect(getTheme('nope').id).toBe('toxic')
    const theme = getTheme('blood')
    expect(colorAt(theme, 0)).toBe(theme.colors[0])
    expect(colorAt(theme, 1)).toBe(theme.colors[theme.colors.length - 1])
  })
})
