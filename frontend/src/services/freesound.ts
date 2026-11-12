import type { DrumVoice } from '../beatmaker/genres'
import type { SampleRef } from '../song/samples'

/** Talks to /api/sounds (our Vercel function), which holds the Freesound key. */

export class SamplesUnavailable extends Error {}

export interface SampleResults {
  results: SampleRef[]
  more: boolean
}

export async function searchSamples(voice: DrumVoice, description: string, page = 1): Promise<SampleResults> {
  const params = new URLSearchParams({ voice, q: description, page: String(page) })
  let response: Response
  try {
    response = await fetch(`/api/sounds?${params}`)
  } catch {
    throw new SamplesUnavailable("I can't reach the sample search right now (are you offline?).")
  }
  const type = response.headers.get('content-type') ?? ''
  // Locally (npm run dev) there is no /api, and Vite answers with the app's HTML.
  if (!type.includes('json')) throw new SamplesUnavailable('Sample search runs on the live site (it needs the Freesound key on the server).')
  const body = (await response.json()) as Partial<SampleResults> & { error?: string }
  if (response.status === 503 || body.error === 'not_configured') throw new SamplesUnavailable("Sample search isn't switched on yet: the site needs a Freesound key (FREESOUND_API_KEY).")
  if (!response.ok) throw new Error(body.error ?? `Sample search failed (${response.status}).`)
  return { results: body.results ?? [], more: Boolean(body.more) }
}

const buffers = new Map<string, Promise<ArrayBuffer>>()

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  try {
    const direct = await fetch(url, { mode: 'cors' })
    if (direct.ok) return await direct.arrayBuffer()
  } catch { /* the CDN may refuse cross-origin reads: go through our function */ }
  const proxied = await fetch(`/api/sounds?audio=${encodeURIComponent(url)}`)
  if (!proxied.ok) throw new Error('Could not download that sample.')
  return proxied.arrayBuffer()
}

/** The MP3 bytes of a sample, fetched once per page load. */
export function sampleBytes(url: string): Promise<ArrayBuffer> {
  let pending = buffers.get(url)
  if (!pending) {
    pending = fetchBytes(url)
    pending.catch(() => buffers.delete(url))
    buffers.set(url, pending)
  }
  return pending
}
