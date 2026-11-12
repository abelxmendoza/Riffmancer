// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SampleRef } from '../src/song/samples'
import { GET } from './sounds'

describe('/api/sounds', () => {
  const key = process.env.FREESOUND_API_KEY
  afterEach(() => { vi.unstubAllGlobals(); if (key === undefined) delete process.env.FREESOUND_API_KEY; else process.env.FREESOUND_API_KEY = key })

  it('says whether it is configured and refuses without a key', async () => {
    delete process.env.FREESOUND_API_KEY
    expect(await (await GET(new Request('http://x/api/sounds'))).json()).toEqual({ configured: false })
    expect((await GET(new Request('http://x/api/sounds?voice=snare'))).status).toBe(503)
    expect((await GET(new Request('http://x/api/sounds?voice=banjo'))).status).toBe(400)
  })

  it('only proxies Freesound previews', async () => {
    expect((await GET(new Request(`http://x/api/sounds?audio=${encodeURIComponent('https://evil.example/a.mp3')}`))).status).toBe(400)
  })

  it('searches with the key on the server and returns samples', async () => {
    process.env.FREESOUND_API_KEY = 'secret'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ next: null, results: [{ id: 5, name: 'Kick.wav', username: 'b', license: 'https://creativecommons.org/licenses/by/4.0/', duration: 0.5, previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/previews/0/5_1-hq.mp3' } }] })))
    vi.stubGlobal('fetch', fetchMock)
    const body = await (await GET(new Request('http://x/api/sounds?voice=kick&q=deep'))).json() as { results: SampleRef[]; more: boolean }
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({ name: 'Kick', license: 'CC BY' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(String(url)).toContain('query=deep+kick+drum')
    expect(String(url)).not.toContain('secret')
    expect((init.headers as Record<string, string>).Authorization).toBe('Token secret')
  })
})
