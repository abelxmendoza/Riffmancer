import { beforeEach, describe, expect, it } from 'vitest'
import { getGenre } from './genres'
import { ACCENT, bassNoteFor, chordNotesFor, cycleVelocity, eventsForStep, GHOST, holdLength, mutateGrid, NORMAL, parseDrumPattern } from './pattern'

describe('drum patterns', () => {
  it('parses accents, hits and ghost notes', () => {
    const grid = parseDrumPattern({ snare: 'X.x.o...........' })
    expect(grid.snare.slice(0, 5)).toEqual([ACCENT, 0, NORMAL, 0, GHOST])
    expect(grid.kick.every((velocity) => velocity === 0)).toBe(true)
  })

  it('cycles a clicked step through off, normal, accent, ghost', () => {
    expect([0, NORMAL, ACCENT, GHOST].map(cycleVelocity)).toEqual([NORMAL, ACCENT, GHOST, 0])
  })

  it('keeps the backbone when mutating', () => {
    const grid = parseDrumPattern(getGenre('metal').drums.main)
    const mutated = mutateGrid(grid, () => 0)
    expect(mutated.kick[0]).toBe(ACCENT)
    expect(mutated.snare[4]).toBe(ACCENT)
    expect(mutated.snare[12]).toBe(ACCENT)
    expect(mutateGrid(grid, () => 1)).toEqual(grid)
  })
})

describe('band events', () => {
  const harmony = { root: 4, scale: 'minor' as const, degree: 1 }

  it('measures held notes', () => {
    expect(holdLength('R---..', 0)).toBe(4)
    expect(holdLength('R.R', 0)).toBe(1)
  })

  it('keeps bass notes in the bass register and follows the chord', () => {
    expect(bassNoteFor('R', harmony)).toBe(28)
    expect(bassNoteFor('8', harmony)).toBe(40)
    expect(bassNoteFor('5', harmony)).toBe(35)
    expect(bassNoteFor('R', { ...harmony, degree: 6 })).toBe(36)
    expect(bassNoteFor('.', harmony)).toBeUndefined()
  })

  it('keeps chords in a steady register', () => {
    for (let degree = 1; degree <= 7; degree += 1) {
      const notes = chordNotesFor({ ...harmony, degree }, 'triad')
      expect(notes[0]).toBeGreaterThanOrEqual(43)
      expect(notes[0]).toBeLessThan(55)
    }
  })

  it('plays drums, bass and palm-muted chords on a metal downbeat', () => {
    const genre = getGenre('metal')
    const events = eventsForStep({ step: 2, grid: parseDrumPattern(genre.drums.main), bass: genre.bass, chords: genre.chords, voicing: genre.voicing, harmony, parts: { drums: true, bass: true, chords: true } })
    expect(events.find((event) => event.part === 'drums' && event.voice === 'kick')).toBeTruthy()
    expect(events.find((event) => event.part === 'bass')).toBeTruthy()
    expect(events.find((event) => event.part === 'chords')).toMatchObject({ muted: true })
  })

  it('leaves out parts that are switched off', () => {
    const genre = getGenre('punk')
    const events = eventsForStep({ step: 0, grid: parseDrumPattern(genre.drums.main), bass: genre.bass, chords: genre.chords, voicing: genre.voicing, harmony, parts: { drums: false, bass: true, chords: false } })
    expect(events.map((event) => event.part)).toEqual(['bass'])
  })
})
