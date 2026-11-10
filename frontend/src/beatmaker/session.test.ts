import { beforeEach, describe, expect, it } from 'vitest'
import { getGenre } from './genres'
import { loadSession, saveSession, sessionForGenre } from './session'

describe('session', () => {
  it('starts from the genre preset and keeps player settings when switching genre', () => {
    const first = sessionForGenre(getGenre('punk'))
    expect(first.bpm).toBe(180)
    const changed = { ...first, keyboard: { ...first.keyboard, mode: 'drums' as const } }
    const next = sessionForGenre(getGenre('reggaeton'), changed)
    expect(next.bpm).toBe(95)
    expect(next.keyboard.mode).toBe('drums')
  })

  it('round-trips through storage and ignores corrupt data', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
    const session = { ...sessionForGenre(getGenre('metal')), bpm: 199 }
    saveSession(session, storage)
    expect(loadSession(storage).bpm).toBe(199)
    data.set('riffmancer.beatmaker.session', '{"version":1')
    expect(loadSession(storage).genreId).toBe('post-punk')
  })
})
