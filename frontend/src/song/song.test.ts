import { describe, expect, it } from 'vitest'
import { GENRES } from '../beatmaker/genres'
import { applyEdit, applyEdits, EditError, resolveTarget } from './edit'
import { generateSong, STRUCTURES } from './generate'
import { SongConductor } from './player'
import { isSongSpec, sectionName, songProblems, totalBars, type SongSpec } from './spec'

const metal = () => generateSong('metal', { seed: 42 })

describe('generateSong', () => {
  it.each(GENRES.map((genre) => genre.id))('makes a valid full song for %s', (id) => {
    const song = generateSong(id, { seed: 7 })
    expect(songProblems(song)).toEqual([])
    expect(isSongSpec(song)).toBe(true)
    expect(song.sections.length).toBeGreaterThanOrEqual(5)
    expect(song.sections.some((section) => section.kind === 'chorus' || section.kind === 'drop')).toBe(true)
  })

  it('follows the genre song shape', () => {
    expect(metal().sections.map((section) => section.kind)).toEqual(STRUCTURES.metal.map((item) => item.kind))
  })

  it('is repeatable with the same seed and different with another', () => {
    expect(generateSong('punk', { seed: 3 }).sections.map((section) => section.lead)).toEqual(generateSong('punk', { seed: 3 }).sections.map((section) => section.lead))
    const leads = new Set([1, 2, 3, 4, 5].map((seed) => generateSong('punk', { seed }).sections[2].lead))
    expect(leads.size).toBeGreaterThan(1)
  })

  it('keeps choruses louder than verses and gives them the melody', () => {
    const song = metal()
    const verse = song.sections.find((section) => section.kind === 'verse')!
    const chorus = song.sections.find((section) => section.kind === 'chorus')!
    expect(chorus.energy).toBeGreaterThan(verse.energy)
    expect(chorus.parts.lead).toBe(true)
    expect(verse.parts.lead).toBe(false)
  })

  it('honours requested tempo, key and structure', () => {
    const song = generateSong('reggaeton', { seed: 1, bpm: 300, root: 2, scale: 'dorian', structure: [{ kind: 'verse', bars: 4 }, { kind: 'chorus', bars: 4 }] })
    expect(song.bpm).toBe(240)
    expect(song.root).toBe(2)
    expect(song.scale).toBe('dorian')
    expect(totalBars(song)).toBe(8)
  })
})

describe('applyEdit', () => {
  it('targets every section of a kind', () => {
    const song = metal()
    expect(resolveTarget(song, { kind: 'chorus' })).toEqual([2, 4, 6])
    expect(resolveTarget(song, { section: 2 })).toEqual([1])
    expect(() => resolveTarget(song, { kind: 'drop' })).toThrow(EditError)
    expect(() => resolveTarget(song, { section: 99 })).toThrow(/no section 99/)
  })

  it('makes only the chorus heavier', () => {
    const song = { ...metal(), sections: metal().sections.map((section) => ({ ...section, energy: 2 as const })) }
    const { song: next, summary } = applyEdit(song, { type: 'energy', direction: 'up', kind: 'chorus' })
    expect(summary).toBe('pushed the energy in every chorus')
    next.sections.forEach((section, index) => expect(section.energy).toBe(section.kind === 'chorus' ? 3 : song.sections[index].energy))
    expect(next.sections[2].drums.crash?.[0]).toBe('X')
  })

  it('writes new drums only where asked, and they stay valid', () => {
    const song = metal()
    const { song: next } = applyEdit(song, { type: 'regenerate', what: 'drums', section: 2 })
    expect(next.sections[1].drums).not.toEqual(song.sections[1].drums)
    expect(next.sections[3].drums).toEqual(song.sections[3].drums)
    expect(songProblems(next)).toEqual([])
  })

  it('adds a section before the outro and can cut it again', () => {
    const song = metal()
    const added = applyEdit(song, { type: 'add_section', kind: 'chorus' }).song
    expect(added.sections).toHaveLength(song.sections.length + 1)
    expect(added.sections.at(-2)!.kind).toBe('chorus')
    expect(added.sections.at(-1)!.kind).toBe('outro')
    const cut = applyEdit(added, { type: 'remove_section', section: added.sections.length - 1 }).song
    expect(cut.sections.map((section) => section.kind)).toEqual(song.sections.map((section) => section.kind))
  })

  it('changes genre but keeps the song shape', () => {
    const song = metal()
    const { song: next } = applyEdit(song, { type: 'change_genre', genre: 'Drum & Bass' })
    expect(next.genreId).toBe('drum-and-bass')
    expect(next.sections.map((section) => section.kind)).toEqual(song.sections.map((section) => section.kind))
    expect(next.bpm).toBe(GENRES.find((genre) => genre.id === 'drum-and-bass')!.bpm.default)
  })

  it('rejects bad patterns with a plain reason instead of breaking the song', () => {
    const song = metal()
    expect(() => applyEdit(song, { type: 'set_bass', pattern: 'nope', kind: 'verse' })).toThrow(/bass must be 16 characters/)
    expect(() => applyEdit(song, { type: 'set_drums', drums: { kick: 'X' }, section: 1 })).toThrow(/kick must be 16 characters/)
    expect(() => applyEdit(song, { type: 'new_song', genre: 'polka' })).toThrow(/unknown genre/)
  })

  it('applies a batch and reports the edits that failed', () => {
    const outcome = applyEdits(metal(), [
      { type: 'set_tempo', delta: 10 },
      { type: 'remove_section', section: 40 },
      { type: 'tone', tweak: 'darker', part: 'chords' },
    ])
    expect(outcome.song.bpm).toBe(160)
    expect(outcome.summaries).toHaveLength(2)
    expect(outcome.errors).toEqual(['there is no section 40; the song has 8'])
    expect(outcome.song.sounds.chords.cutoff).toBeLessThan(metal().sounds.chords.cutoff)
  })

  it('names sections the way people do', () => {
    const song = metal()
    expect(sectionName(song, 0)).toBe('Intro')
    expect(sectionName(song, 4)).toBe('Chorus 2')
  })
})

describe('SongConductor', () => {
  const play = (song: SongSpec, steps: number, setup?: (conductor: SongConductor) => void) => {
    const conductor = new SongConductor(() => song)
    setup?.(conductor)
    return Array.from({ length: steps }, () => conductor.tick())
  }

  it('walks through every section in order, then wraps', () => {
    const song = generateSong('punk', { seed: 2, structure: [{ kind: 'intro', bars: 1 }, { kind: 'verse', bars: 2 }, { kind: 'chorus', bars: 1 }] })
    const ticks = play(song, 16 * 5)
    expect(ticks.filter((tick) => tick.step === 0).map((tick) => tick.sectionIndex)).toEqual([0, 1, 1, 2, 0])
    expect(ticks[16 * 4].wrapped).toBe(true)
  })

  it('plays the fill on the last bar and a crash on the next section', () => {
    const base = generateSong('metal', { seed: 2, structure: [{ kind: 'verse', bars: 2 }, { kind: 'chorus', bars: 2 }] })
    const song = { ...base, sections: base.sections.map((section) => ({ ...section, fill: true })) }
    const ticks = play(song, 16 * 3)
    expect(ticks[0].fill).toBe(false)
    expect(ticks[16].fill).toBe(true)
    expect(ticks[32].events.some((event) => event.part === 'drums' && event.voice === 'crash')).toBe(true)
  })

  it('plays the melody only where it is switched on', () => {
    const song = generateSong('punk', { seed: 9, structure: [{ kind: 'verse', bars: 1 }, { kind: 'chorus', bars: 1 }] })
    const ticks = play(song, 32)
    expect(ticks.slice(0, 16).some((tick) => tick.events.some((event) => event.part === 'lead'))).toBe(false)
    expect(ticks.slice(16).some((tick) => tick.events.some((event) => event.part === 'lead'))).toBe(true)
  })

  it('loops one section and can start from any section', () => {
    const song = generateSong('punk', { seed: 2, structure: [{ kind: 'intro', bars: 1 }, { kind: 'verse', bars: 2 }, { kind: 'chorus', bars: 1 }] })
    const ticks = play(song, 16 * 4, (conductor) => { conductor.startAt(1); conductor.loopSection = 1 })
    expect(ticks.filter((tick) => tick.step === 0).map((tick) => tick.sectionIndex)).toEqual([1, 1, 1, 1])
  })

  it('plays quieter sections softer', () => {
    const song = generateSong('punk', { seed: 2, structure: [{ kind: 'verse', bars: 1 }] })
    const loud = play({ ...song, sections: [{ ...song.sections[0], energy: 3 }] }, 1)[0]
    const soft = play({ ...song, sections: [{ ...song.sections[0], energy: 1 }] }, 1)[0]
    expect(soft.events[0].velocity).toBeLessThan(loud.events[0].velocity)
  })
})
