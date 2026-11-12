import { DRUM_VOICES, type DrumVoice } from '../src/beatmaker/genres/types'
import { sampleSearch, toSampleRef, type FreesoundHit } from '../src/song/samples'

/**
 * Freesound search for Fret, deployed as a Vercel function at /api/sounds.
 * The Freesound key (FREESOUND_API_KEY) stays here on the server; the browser never sees it.
 *
 *   GET /api/sounds                              -> { configured }
 *   GET /api/sounds?voice=snare&q=dirty&page=1   -> { results: SampleRef[], more }
 *   GET /api/sounds?audio=<cdn.freesound.org preview URL>  -> the MP3 (fallback when the CDN blocks the browser)
 */

const API = 'https://freesound.org/apiv2/search/'
const PREVIEWS = 'https://cdn.freesound.org/previews/'
const PAGE_SIZE = 8

const json = (body: unknown, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

export async function GET(request: Request) {
  const key = process.env.FREESOUND_API_KEY
  const params = new URL(request.url).searchParams

  const audio = params.get('audio')
  if (audio) {
    if (!audio.startsWith(PREVIEWS) || audio.includes('..')) return json({ error: 'Only Freesound previews can be fetched.' }, 400)
    const upstream = await fetch(audio)
    if (!upstream.ok || !upstream.body) return json({ error: 'Freesound did not send that preview.' }, 502)
    return new Response(upstream.body, { headers: { 'content-type': upstream.headers.get('content-type') ?? 'audio/mpeg', 'cache-control': 'public, max-age=86400, s-maxage=604800' } })
  }

  const voice = params.get('voice')
  if (!voice) return json({ configured: Boolean(key) })
  if (!DRUM_VOICES.includes(voice as DrumVoice)) return json({ error: `Unknown drum "${voice}".` }, 400)
  if (!key) return json({ error: 'not_configured' }, 503)

  const description = (params.get('q') ?? '').slice(0, 100)
  const page = Math.max(1, Math.min(20, Number(params.get('page')) || 1))
  const { query, filter } = sampleSearch(voice as DrumVoice, description, params.get('nc') === '1')
  const url = new URL(API)
  url.search = new URLSearchParams({ query, filter, sort: 'score', fields: 'id,name,username,license,duration,url,previews', page_size: String(PAGE_SIZE), page: String(page) }).toString()

  const response = await fetch(url, { headers: { Authorization: `Token ${key}` } })
  if (response.status === 404) return json({ results: [], more: false })
  if (response.status === 429) return json({ error: 'Freesound says slow down (too many searches). Try again in a minute.' }, 429)
  if (!response.ok) return json({ error: `Freesound search failed (${response.status}).` }, 502)
  const data = (await response.json()) as { results?: FreesoundHit[]; next?: string | null }
  const results = (data.results ?? []).map(toSampleRef).filter(Boolean)
  // Same search, same answer for a while: saves Freesound's daily limit.
  return json({ results, more: Boolean(data.next) }, 200, 'public, max-age=300, s-maxage=86400')
}
