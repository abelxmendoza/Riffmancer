import { describe, expect, it } from 'vitest'
import { GENRES } from '../beatmaker/genres'
import { defaultPresetFor, delaySeconds, getVocalPreset, MASTER_PRESETS, presetsForGenre, VOCAL_PRESETS } from './presets'

describe('vocal presets', () => {
  it('uses unique ids', () => {
    expect(new Set(VOCAL_PRESETS.map((preset) => preset.id)).size).toBe(VOCAL_PRESETS.length)
  })

  it('covers every Beat Maker genre, with at least two presets for each main genre', () => {
    for (const genre of GENRES) {
      const own = VOCAL_PRESETS.filter((preset) => preset.genre === genre.id)
      expect(own.length, genre.id).toBeGreaterThanOrEqual(genre.primary ? 2 : 1)
    }
  })

  it('has clean and scream options for metal', () => {
    const roles = VOCAL_PRESETS.filter((preset) => preset.genre === 'metal').map((preset) => preset.role)
    expect(roles).toContain('lead')
    expect(roles).toContain('scream')
  })

  it.each(VOCAL_PRESETS.map((preset) => [preset.name, preset] as const))('%s stays in safe ranges', (_name, preset) => {
    const chain = preset.chain
    expect(chain.lowCut).toBeGreaterThanOrEqual(20)
    expect(chain.highCut).toBeGreaterThan(chain.lowCut)
    for (const value of [chain.deess, chain.drive, chain.driveMix, chain.octaveDown, chain.doubler, chain.chorus, chain.delayMix, chain.reverbMix]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
    expect(chain.delayFeedback).toBeLessThan(0.9)
    expect(chain.compRatio).toBeGreaterThanOrEqual(1)
    expect(chain.compThreshold).toBeLessThanOrEqual(0)
    expect(Math.abs(chain.low) + Math.abs(chain.mid) + Math.abs(chain.high)).toBeLessThan(30)
    expect(chain.reverbDecay).toBeGreaterThan(0)
    expect(preset.description).not.toBe('')
  })

  it('master presets keep a ceiling under 0 dBFS', () => {
    for (const preset of MASTER_PRESETS) expect(preset.chain.ceiling).toBeLessThan(0)
  })

  it('picks a preset by genre and role, falling back to the genre lead then Natural', () => {
    expect(defaultPresetFor('metal', 'scream').id).toBe('metal-scream')
    expect(defaultPresetFor('metal', 'harmony').id).toBe('metal-clean')
    expect(defaultPresetFor('polka').id).toBe('natural')
    expect(getVocalPreset('nope').id).toBe('natural')
    expect(presetsForGenre('punk').map((preset) => preset.genre)).toEqual(expect.arrayContaining(['punk', 'utility']))
  })

  it('syncs delays to tempo', () => {
    expect(delaySeconds('4n', 120)).toBeCloseTo(0.5)
    expect(delaySeconds('8n.', 120)).toBeCloseTo(0.375)
    expect(delaySeconds('2n', 30)).toBeLessThan(2)
  })
})
