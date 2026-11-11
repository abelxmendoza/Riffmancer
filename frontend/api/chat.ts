import Anthropic from '@anthropic-ai/sdk'
import { LIVE_SYSTEM_PROMPT } from '../src/assistant/persona'

/**
 * Optional live AI for Fret, deployed as a Vercel function at /api/chat.
 * Only used for questions the built-in brain can't answer. Without ANTHROPIC_API_KEY
 * it reports { live: false } and the chat keeps working offline.
 */

const MAX_TURNS = 12
const MAX_CHARS = 1500

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export function GET() {
  return json({ live: Boolean(process.env.ANTHROPIC_API_KEY) })
}

function toMessages(turns: unknown): Anthropic.Beta.BetaMessageParam[] | undefined {
  if (!Array.isArray(turns)) return undefined
  const clean = turns
    .filter((turn): turn is Turn => Boolean(turn) && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string')
    .slice(-MAX_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.text.slice(0, MAX_CHARS) }))
  // The API needs the conversation to start with the player.
  while (clean.length && clean[0].role !== 'user') clean.shift()
  return clean.length && clean[clean.length - 1].role === 'user' ? clean : undefined
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Live AI is not configured.' }, 503)
  let body: { messages?: unknown; context?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send JSON.' }, 400)
  }
  const messages = toMessages(body.messages)
  if (!messages) return json({ error: 'The last message must come from the player.' }, 400)

  const context = body.context && typeof body.context === 'object'
    ? `Current Beat Maker state (for reference only): ${JSON.stringify(body.context).slice(0, 400)}`
    : ''

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: LIVE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }, ...(context ? [{ type: 'text' as const, text: context }] : [])],
      messages,
    })
    if (response.stop_reason === 'refusal') return json({ answer: "I can't help with that one, but I can make you a beat. Try \"make a punk beat\"." })
    const answer = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n').trim()
    return answer ? json({ answer }) : json({ error: 'Empty answer.' }, 502)
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Live AI is busy. Try again in a moment.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: `Live AI error ${error.status ?? ''}`.trim() }, 502)
    return json({ error: 'Live AI is unreachable.' }, 502)
  }
}
