import { beforeEach, describe, expect, it } from 'vitest'
import { respond } from '../assistant/engine'
import { respondSong } from '../assistant/songBrain'
import { generateSong } from '../song/generate'
import { applyThemeRequest, followGenre, getThemeState, setTheme } from './store'
import { APP_THEMES, parseThemeRequest, themeForGenre } from './themes'
import { THEMES } from '../player/themes'

describe('app themes', () => {
  beforeEach(() => setTheme('toxic', true))

  it('has a theme for every genre the person plays, matching the Player themes', () => {
    for (const genre of ['post-punk', 'metal', 'punk', 'drum-and-bass', 'reggaeton']) expect(themeForGenre(genre).id).not.toBe('toxic')
    expect(APP_THEMES.map((theme) => theme.id).sort()).toEqual(THEMES.map((theme) => theme.id).sort())
  })

  it('paints the colours onto the page', () => {
    setTheme('blood')
    expect(document.documentElement.dataset.theme).toBe('blood')
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#F87171')
    expect(getThemeState()).toEqual({ id: 'blood', follow: false })
  })

  it('follows the song genre only while "match my song" is on', () => {
    followGenre('metal')
    expect(getThemeState().id).toBe('blood')
    setTheme('neon')
    followGenre('punk')
    expect(getThemeState().id).toBe('neon')
    applyThemeRequest({ follow: true })
    followGenre('punk')
    expect(getThemeState().id).toBe('riot')
  })

  it('reads theme requests and ignores music talk', () => {
    expect(parseThemeRequest('make the app look metal')).toEqual({ themeId: 'blood', follow: false })
    expect(parseThemeRequest('coldwave theme')).toEqual({ themeId: 'coldwave', follow: false })
    expect(parseThemeRequest('colours should match my song')).toEqual({ follow: true })
    expect(parseThemeRequest('make a metal song')).toBeUndefined()
    expect(respondSong('blood moon theme please', generateSong('punk', { seed: 1 })).theme).toEqual({ themeId: 'blood', follow: false })
  })

  it('works from the chat bar on any page', () => {
    const reply = respond('switch the theme to neon', { route: 'beats', beat: { ready: false, playing: false, genreId: 'punk', bpm: 170, root: 0, scale: 'minor' } } as Parameters<typeof respond>[1])
    expect(reply.theme).toEqual({ themeId: 'neon', follow: false })
  })
})
