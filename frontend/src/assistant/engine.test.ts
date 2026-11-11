import { describe, expect, it } from 'vitest'
import type { BeatStatus } from './bus'
import { chipsFor, findGenre, findKey, respond } from './engine'

const beat: BeatStatus = { ready: true, playing: false, genreId: 'post-punk', bpm: 142, root: 4, scale: 'minor' }
const ctx = { route: 'beats' as const, beat }

describe('assistant brain', () => {
  it('recognizes genres, with post punk winning over punk', () => {
    expect(findGenre('make it post punk')).toBe('post-punk')
    expect(findGenre('some punk please')).toBe('punk')
    expect(findGenre('dnb vibes')).toBe('drum-and-bass')
    expect(findGenre('dembow')).toBe('reggaeton')
    expect(findGenre('thrash it')).toBe('metal')
  })

  it('reads keys without mistaking ordinary words', () => {
    expect(findKey('key of a minor')).toEqual({ root: 9, scale: 'minor' })
    expect(findKey('in f# major')).toEqual({ root: 6, scale: 'major' })
    expect(findKey('in a minute')).toBeUndefined()
  })

  it('turns a request into Beat Maker actions', () => {
    const result = respond('Make a metal beat at 170 bpm', ctx)
    expect(result.actions).toEqual([{ type: 'genre', id: 'metal' }, { type: 'tempo', bpm: 170 }, { type: 'play' }])
    expect(result.mood).toBe('rocking')
    expect(result.unknown).toBe(false)
  })

  it('handles transport, fills, variations and parts', () => {
    const playing = { ...ctx, beat: { ...beat, playing: true } }
    expect(respond('faster', playing).actions).toEqual([{ type: 'tempo', delta: 10 }])
    expect(respond('add a fill', playing).actions).toEqual([{ type: 'fill' }])
    expect(respond('switch to beat B', playing).actions).toEqual([{ type: 'variation', which: 'alt' }])
    expect(respond('drop the bass', playing).actions).toEqual([{ type: 'part', part: 'bass', on: false }])
    expect(respond('stop', playing).actions).toEqual([{ type: 'stop' }])
  })

  it('tells apart a darker synth from a darker song', () => {
    expect(respond('make the synth darker', ctx).actions).toEqual([{ type: 'synth', tweak: 'darker' }])
    expect(respond('make it more evil', ctx).actions).toEqual([{ type: 'key', scale: 'phrygian' }])
  })

  it('opens the Beat Maker when a command comes from another page', () => {
    expect(respond('make it reggaeton', { ...ctx, route: 'home' }).navigate).toBe('beats')
    expect(respond('open the stem lab', ctx).navigate).toBe('stems')
  })

  it('answers how-to questions without changing anything', () => {
    const result = respond('How do I play chords?', ctx)
    expect(result.actions).toEqual([])
    expect(result.text).toMatch(/white key/)
  })

  it('admits when it does not know', () => {
    const result = respond('what is the capital of peru', ctx)
    expect(result.unknown).toBe(true)
    expect(result.mood).toBe('confused')
  })

  it('offers chips that fit the page', () => {
    expect(chipsFor('beats', { ...beat, playing: true })).toContain('Add a fill')
    expect(chipsFor('home', beat).length).toBeGreaterThan(2)
  })
})
