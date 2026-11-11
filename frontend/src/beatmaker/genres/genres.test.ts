import { beforeEach, describe, expect, it } from 'vitest'
import { DRUM_VOICES, GENRES, allPatches } from '.'

const DRUM_CHARS = /^[Xxo.]{16}$/
const BASS_CHARS = /^[Rr3578.-]{16}$/
const CHORD_CHARS = /^[Xxm.-]{16}$/

describe('genre registry', () => {
  it('has the five main genres', () => {
    const primary = GENRES.filter((genre) => genre.primary).map((genre) => genre.id)
    expect(primary).toEqual(expect.arrayContaining(['post-punk', 'metal', 'punk', 'drum-and-bass', 'reggaeton']))
  })

  it('uses unique ids', () => {
    expect(new Set(GENRES.map((genre) => genre.id)).size).toBe(GENRES.length)
  })

  it.each(GENRES.map((genre) => [genre.name, genre] as const))('%s is a valid genre', (_name, genre) => {
    expect(genre.bpm.min).toBeLessThanOrEqual(genre.bpm.default)
    expect(genre.bpm.default).toBeLessThanOrEqual(genre.bpm.max)
    expect(genre.key.root).toBeGreaterThanOrEqual(0)
    expect(genre.key.root).toBeLessThan(12)
    expect(genre.progression.length).toBeGreaterThan(0)
    for (const degree of genre.progression) expect(degree >= 1 && degree <= 7).toBe(true)
    for (const pattern of [genre.drums.main, genre.drums.alt, genre.drums.fill]) {
      for (const [voice, line] of Object.entries(pattern)) {
        expect(DRUM_VOICES).toContain(voice)
        expect(line).toMatch(DRUM_CHARS)
      }
    }
    expect(genre.bass).toMatch(BASS_CHARS)
    expect(genre.chords).toMatch(CHORD_CHARS)
    expect(genre.drums.main.kick).toBeDefined()
    expect(genre.tips.length).toBeGreaterThan(0)
  })

  it('exposes every genre sound as a synth preset without duplicates', () => {
    const names = allPatches().map((patch) => patch.name)
    expect(new Set(names).size).toBe(names.length)
    for (const genre of GENRES) expect(names).toContain(genre.sounds.lead.name)
  })
})
