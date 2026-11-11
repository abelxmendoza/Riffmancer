export interface LiveTurn {
  role: 'user' | 'assistant'
  text: string
}

export type LiveState = 'checking' | 'live' | 'offline'

const ENDPOINT = '/api/chat'

/** Checks whether the deployment has the optional live AI route (needs ANTHROPIC_API_KEY on the server). */
export async function probeLive(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } })
    if (!response.ok) return false
    const body = (await response.json()) as { live?: boolean }
    return body.live === true
  } catch {
    return false
  }
}

export async function askLive(history: LiveTurn[], context: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<string> {
  const response = await fetcher(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: history.slice(-12), context }),
  })
  if (!response.ok) throw new Error(`Live AI answered ${response.status}`)
  const body = (await response.json()) as { answer?: string }
  if (!body.answer) throw new Error('Live AI sent an empty answer')
  return body.answer
}
