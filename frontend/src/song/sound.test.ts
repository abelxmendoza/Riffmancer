import { describe, expect, it } from 'vitest'
import { GENRES } from '../beatmaker/genres'
import { applyEdit, applyEdits } from './edit'
import { generateSong } from './generate'
import { applyPatchSettings, designKit, designPatch, describesSound, parseSoundRequests } from './sound'
import { findStyle, getStyle, STYLES } from './styles'
import { songProblems } from './spec'
import { SONG_TOOLS } from './tools'

const song = () => generateSong('post-punk', { seed: 7 })

describe('sound descriptions', () => {
  it('splits a request into one description per part', () => {
    const requests = parseSoundRequests('fuzzy wide guitars and a deep gliding 808, glassy bells on top, roomy drums')
    expect(requests.map((request) => request.part).sort()).toEqual(['bass', 'chords', 'drums', 'lead'])
    expect(requests.find((request) => request.part === 'bass')?.instrument).toBe('808 bass')
    expect(requests.find((request) => request.part === 'chords')?.words).toEqual(expect.arrayContaining(['distorted', 'wide']))
  })

  it('sticks describing words to the instrument before them', () => {
    const [request] = parseSoundRequests('guitars that are fuzzy and wide')
    expect(request.part).toBe('chords')
    expect(request.words).toEqual(expect.arrayContaining(['distorted', 'wide']))
  })

  it('tells sound talk from arrangement talk', () => {
    expect(describesSound('make the bass an 808')).toBe(true)
    expect(describesSound('dreamy chords')).toBe(true)
    expect(describesSound('heavier chorus')).toBe(false)
    expect(describesSound('add a bridge')).toBe(false)
  })

  it('builds a new instrument, or tweaks the same one', () => {
    const base = song().sounds.chords
    const piano = designPatch('piano', base, 'chords')!
    expect(piano.patch.name).toBe('Piano')
    expect(piano.patch.wave).toBe('triangle')
    // The post punk chords are a synth guitar: "fuzzier guitars" swaps in a recorded dirty guitar.
    const fuzz = designPatch('fuzzier guitars', base, 'chords')!
    expect(fuzz.patch.sample).toMatch(/(overdriven|distortion)_guitar/)
    expect(fuzz.patch.drive).toBeGreaterThan(base.drive)
    // On a recorded guitar it keeps that guitar and adds drive.
    const clean = designPatch('clean guitar', base, 'chords')!.patch
    const fuzzier = designPatch('fuzzier guitars', clean, 'chords')!.patch
    expect(fuzzier.sample).toBe('electric_guitar_clean')
    expect(fuzzier.drive).toBeGreaterThan(clean.drive)
    const dark = designPatch('darker and wider', base, 'chords')!
    expect(dark.patch.cutoff).toBeLessThan(base.cutoff)
    expect(dark.patch.chorus).toBeGreaterThan(base.chorus)
    expect(designPatch('purple', base, 'chords')).toBeUndefined()
  })

  it('designs drum kits', () => {
    const base = song().kit
    const trap = designKit('808 drums', base)!
    expect(trap.kit.kickDecay).toBeGreaterThan(base.kickDecay)
    const roomy = designKit('roomy and punchy', base)!
    expect(roomy.kit.room).toBeGreaterThan(base.room)
    expect(roomy.kit.kickPunch).toBeGreaterThan(base.kickPunch)
  })

  it('clamps exact settings and ignores unknown ones', () => {
    const patch = applyPatchSettings(song().sounds.lead, { cutoff: 999999, drive: -3, wave: 'square', nonsense: 4, volume: 'loud' })
    expect(patch.cutoff).toBe(16000)
    expect(patch.drive).toBe(0)
    expect(patch.wave).toBe('square')
    expect(patch).not.toHaveProperty('nonsense')
  })
})

describe('design_sound edit', () => {
  it('changes one part and says what it became', () => {
    const before = song()
    const result = applyEdit(before, { type: 'design_sound', part: 'bass', description: 'deep gliding 808' })
    expect(result.song.sounds.bass.glide).toBeGreaterThan(0)
    expect(result.song.sounds.chords).toBe(before.sounds.chords)
    expect(result.summary).toMatch(/gave the bass an? .*808/)
  })

  it('takes exact settings from the live AI', () => {
    const result = applyEdit(song(), { type: 'design_sound', part: 'drums', settings: { room: 0.9, kickPitch: 5 } })
    expect(result.song.kit.room).toBe(0.9)
    expect(result.song.kit.kickPitch).toBe(20)
  })

  it('refuses sounds it cannot make, with a plain reason', () => {
    const outcome = applyEdits(song(), [{ type: 'design_sound', part: 'lead', description: 'purple' }, { type: 'design_sound', part: 'kazoo' as never, description: 'loud' }])
    expect(outcome.errors).toHaveLength(2)
    expect(outcome.errors[0]).toMatch(/don't know how/)
  })
})

describe('styles', () => {
  it('every style is built on a real engine and makes a valid song', () => {
    const ids = new Set<string>()
    for (const style of STYLES) {
      expect(GENRES.some((genre) => genre.id === style.genre), style.id).toBe(true)
      expect(ids.has(style.id), style.id).toBe(false)
      ids.add(style.id)
      const { song: next } = applyEdit(song(), { type: 'new_song', style: style.id })
      expect(songProblems(next), style.id).toEqual([])
      expect(next.style).toBe(style.name)
      expect(next.genreId).toBe(style.genre)
      // Every sound description in the catalogue must be understood.
      for (const [part, description] of Object.entries(style.sounds)) {
        const understood = part === 'drums' ? designKit(description, next.kit) : designPatch(description, next.sounds.lead, part as 'lead')
        expect(understood, `${style.id} ${part}: ${description}`).toBeDefined()
      }
    }
  })

  it('finds specific styles before general ones', () => {
    expect(findStyle('a pop punk song')?.id).toBe('pop-punk')
    expect(findStyle('latin trap beat')?.id).toBe('latin-trap')
    expect(findStyle('some trap')?.id).toBe('trap')
    expect(findStyle('make a metal song')).toBeUndefined()
    expect(getStyle('Liquid drum & bass')?.id).toBe('liquid-dnb')
  })

  it('keeps tempo and key the person asked for over the style defaults', () => {
    const { song: next } = applyEdit(song(), { type: 'new_song', style: 'synthwave', bpm: 100, root: 2, scale: 'dorian' })
    expect([next.bpm, next.root, next.scale]).toEqual([100, 2, 'dorian'])
  })

  it('lets the live AI invent a style on top of an engine', () => {
    const { song: next, summary } = applyEdit(song(), { type: 'new_song', genre: 'punk', style: 'Polka punk', sounds: { chords: 'accordion organ, bright', drums: 'live drums' } })
    expect(next.style).toBe('Polka punk')
    expect(next.sounds.chords.name).toMatch(/organ/i)
    expect(summary).toMatch(/Polka punk/)
    expect(() => applyEdit(song(), { type: 'new_song', style: 'polka' })).toThrow(/give a genre/)
  })

  it('changing genre clears the old style', () => {
    const styled = applyEdit(song(), { type: 'new_song', style: 'shoegaze' }).song
    expect(applyEdit(styled, { type: 'change_genre', genre: 'metal' }).song.style).toBeUndefined()
  })

  it('offers design_sound and styles to the live AI', () => {
    const tool = SONG_TOOLS.find((candidate) => candidate.name === 'design_sound')
    expect(tool?.input_schema.required).toEqual(['part'])
    const newSong = SONG_TOOLS.find((candidate) => candidate.name === 'new_song')
    expect(newSong?.input_schema.required).toBeUndefined()
    expect(JSON.stringify(newSong)).toContain('shoegaze')
  })
})
