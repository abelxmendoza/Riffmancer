import { beforeEach, describe, expect, it } from 'vitest'
import { respondSong, vocalPresetForSong } from '../assistant/songBrain'
import { describedVocalAction, respondStudio } from '../assistant/studioBrain'
import { generateSong } from '../song/generate'
import { applyEdit } from '../song/edit'
import { STYLE_VOCALS, STYLES } from '../song/styles'
import { allVocalPresets, getVocalPreset, NATURAL } from './presets'
import { loadUserPresets, saveUserPreset } from './userPresets'
import { describeVocal, sanitizeChain } from './vocalSound'

describe('vocal descriptions', () => {
  it('turns words into a chain', () => {
    const dreamy = describeVocal('dreamy vocals with lots of reverb and a dotted delay')
    expect(dreamy.words).toEqual(expect.arrayContaining(['huge reverb', 'dreamy', 'dotted delay']))
    expect(dreamy.chain.reverbMix).toBeGreaterThan(NATURAL.reverbMix)
    expect(dreamy.chain.delayTime).toBe('8n.')
    const shout = describeVocal('gritty megaphone shout')
    expect(shout.chain.drive).toBeGreaterThan(0.5)
    expect(shout.chain.highCut).toBeLessThan(6000)
    expect(describeVocal('dry and upfront').chain.reverbMix).toBeLessThan(0.1)
  })

  it('names effects the Studio does not have instead of faking them', () => {
    const result = describeVocal('auto-tune with a slapback')
    expect(result.missing).toEqual(['pitch correction (auto-tune)'])
    expect(result.words).toContain('slapback')
  })

  it('keeps every value in range', () => {
    const chain = sanitizeChain({ reverbMix: 9, lowCut: -5, delayTime: 'forever' as never, compRatio: Number.NaN })
    expect(chain.reverbMix).toBe(1)
    expect(chain.lowCut).toBe(20)
    expect(chain.delayTime).toBe(NATURAL.delayTime)
    expect(chain.compRatio).toBe(NATURAL.compRatio)
  })

  it('every style has a vocal sound Fret understands', () => {
    for (const style of STYLES) {
      expect(STYLE_VOCALS[style.id], style.id).toBeDefined()
      expect(describeVocal(STYLE_VOCALS[style.id]).words.length, style.id).toBeGreaterThan(1)
    }
  })
})

describe('your presets', () => {
  beforeEach(() => window.localStorage.clear())

  it('saves, replaces by name and reloads', () => {
    saveUserPreset('Cave Voice', describeVocal('huge reverb').chain)
    const again = saveUserPreset('Cave Voice', describeVocal('dry').chain)
    expect(allVocalPresets().filter((preset) => preset.genre === 'mine')).toHaveLength(1)
    expect(getVocalPreset(again.id).chain.reverbMix).toBeLessThan(0.1)
    expect(loadUserPresets()[0].name).toBe('Cave Voice')
  })

  it('ignores broken saved data', () => {
    window.localStorage.setItem('riffmancer.studio.userPresets', '{"not":"a list"}')
    expect(loadUserPresets()).toEqual([])
  })
})

describe('Fret and vocal presets', () => {
  const context = { route: 'studio' as const, beat: { ready: false, playing: false, genreId: 'metal', bpm: 150, root: 4, scale: 'minor' as const }, studio: { ready: true, playing: false, recording: false, genre: 'metal', bpm: 150, tracks: 1 } }

  it('builds a preset from words in the Studio', () => {
    const reply = respondStudio('make my vocals dreamy with lots of reverb', context)
    expect(reply?.studioActions?.[0]).toMatchObject({ type: 'customPreset', name: expect.stringMatching(/vocal/i) })
    expect(reply?.navigate).toBeUndefined()
    expect(describedVocalAction('purple', 'metal')).toBeUndefined()
  })

  it('still picks the built-in presets by name', () => {
    expect(respondStudio('use the scream preset', context)?.studioActions).toEqual([{ type: 'preset', id: 'metal-scream' }])
  })

  it('opens the Studio when asked from another page', () => {
    const reply = respondStudio('make me a vocal preset with a slapback and grit', { ...context, route: 'player' as const })
    expect(reply?.navigate).toBe('studio')
    expect(reply?.studioActions?.[0].type).toBe('customPreset')
  })

  it('saves the current sound', () => {
    expect(respondStudio('save this as a preset called Night Shift', context)?.studioActions).toEqual([{ type: 'savePreset', name: 'Night Shift' }])
  })

  it('makes a vocal preset that fits the song on Create', () => {
    const song = applyEdit(generateSong('post-punk', { seed: 2 }), { type: 'new_song', style: 'shoegaze' }).song
    const fitted = vocalPresetForSong(song)
    expect(fitted.words).toContain('dreamy')
    expect(fitted.action.name).toContain(song.title.slice(0, 10))
    const reply = respondSong('vocal preset for this song', song)
    expect(reply.studio?.at(-1)?.type).toBe('customPreset')
    expect(reply.sendToStudio).toBeUndefined()
    expect(respondSong('record vocals over this', song).sendToStudio).toBe(true)
    expect(respondSong('i want dark doubled vocals with auto-tune', song).text).toMatch(/can't do pitch correction/)
  })
})

describe('copying a vocal sound from a song', () => {
  const context = { route: 'create' as const, beat: { ready: false, playing: false, genreId: 'metal', bpm: 150, root: 4, scale: 'minor' as const } }
  it('opens the matcher from any page', () => {
    for (const ask of ['copy the vocal effects from a song i like', 'match the vocals on this track', 'i want my voice to sound like the singer from a song on the radio', 'use the same vocal sound as this song']) {
      const reply = respondStudio(ask, { ...context, route: 'player' })
      expect(reply?.studioActions, ask).toEqual([{ type: 'matchReference' }])
      expect(reply?.navigate, ask).toBe('studio')
    }
  })

  it('works from Create too', () => {
    const song = generateSong('punk', { seed: 3 })
    expect(respondSong('copy the vocal sound from a song i like', song).studio).toEqual([{ type: 'matchReference' }])
    expect(respondSong('copy the vocal sound from a song i like', undefined).studio).toEqual([{ type: 'matchReference' }])
  })
})
