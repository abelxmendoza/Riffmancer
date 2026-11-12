import type { SongEdit } from '../song/edit'
import type { SongSpec } from '../song/spec'
import { songForModel } from '../song/tools'
import type { LiveTurn } from './live'

const ENDPOINT = '/api/fret'

/** Checks whether the deployment has the live producer route (needs ANTHROPIC_API_KEY on the server). */
export async function probeSongLive(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } })
    if (!response.ok) return false
    const body = (await response.json()) as { live?: boolean }
    return body.live === true
  } catch {
    return false
  }
}

export interface LiveSongAnswer {
  answer: string
  edits: SongEdit[]
}

export async function askSongLive(history: LiveTurn[], song: SongSpec | undefined, fetcher: typeof fetch = fetch): Promise<LiveSongAnswer> {
  const response = await fetcher(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: history.slice(-10), song: songForModel(song) }),
  })
  if (!response.ok) throw new Error(`Live AI answered ${response.status}`)
  const body = (await response.json()) as Partial<LiveSongAnswer>
  return { answer: typeof body.answer === 'string' ? body.answer : '', edits: Array.isArray(body.edits) ? body.edits : [] }
}
