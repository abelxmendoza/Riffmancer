import Anthropic from '@anthropic-ai/sdk'
import { ASSISTANT_NAME } from '../src/assistant/persona'
import type { SongEdit } from '../src/song/edit'
import { editFromToolCall, SONG_TOOLS } from '../src/song/tools'

/**
 * Fret's live producer brain, deployed as a Vercel function at /api/fret.
 * Claude reads the current song and answers with tool calls (song edits) that the browser applies.
 * Only used for requests the offline brain doesn't understand, and only when ANTHROPIC_API_KEY is set.
 */

const MAX_TURNS = 10
const MAX_CHARS = 1500
const MAX_SONG_CHARS = 24000

const SYSTEM_PROMPT = `You are ${ASSISTANT_NAME}, the producer inside Riffmancer, a browser app that writes instrumentals for musicians who don't know music production. The player talks to you; you write and change their song with the tools.

How songs work: a song is a list of sections (intro, verse, chorus, drop, bridge, breakdown, build, break, outro). Each section has bars, an energy level (1-3), a chord progression in scale degrees, a 16-step drum pattern, bass and chord rhythms and an optional melody. There are seven song engines (post punk, metal, punk, drum & bass, reggaeton, boom bap, house) and many styles built on them (shoegaze, trap, techno, doom, liquid dnb and more). Any genre the player names works: use a known style, or pick the closest engine and give a style label plus sound descriptions. Instruments are synthesized from plain-word descriptions (design_sound), so "fuzzy guitars", "a deep gliding 808" or "roomy live drums" all work.

Rules:
- Make every change the request needs in this one reply, using the tools. Prefer the high-level tools (energy, feel, regenerate, tone, add_section) and write raw patterns only when the request needs something specific.
- "the chorus" means every chorus: use kind. Use section (1-based position) for one specific section.
- When the player names a real band or song, capture its style (tempo, feel, mood, instrumentation, song shape) with original parts. Never try to recreate a copyrighted melody, riff or lyric note for note; say you made something in that spirit.
- After the tool calls, reply in one or two short, upbeat sentences, plain words, no markdown, saying what you changed. If the request isn't about the song, answer briefly and make no tool calls.
- Sounds are synthesized, not recorded: describe instruments as closely as you can with design_sound, and say it's a synth take if the player expects a real recording.
- Vocals are recorded in the Studio, not generated. If the player asks about vocals or vocal effects, tell them to say "vocal preset for this song", describe the vocal sound in words ("dreamy vocals with lots of reverb"), or press "Sing over it" to record over the song. You can't write lyrics into the song.
- Real recorded drum hits come from Freesound, not from you: if the player wants real or sampled drums, tell them to say it plainly, like "use a real snare" or "real recorded drums", and the app finds them.
- The app's colours change with "blood moon theme" or "match my song"; you don't need a tool for that.
- If something can't be done with these tools (lyrics, effects that don't exist), say so plainly.`

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export function GET() {
  return json({ live: Boolean(process.env.ANTHROPIC_API_KEY) })
}

function toMessages(turns: unknown, song: unknown): Anthropic.Beta.BetaMessageParam[] | undefined {
  if (!Array.isArray(turns)) return undefined
  const clean = turns
    .filter((turn): turn is Turn => Boolean(turn) && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string' && turn.text.trim().length > 0)
    .slice(-MAX_TURNS)
    .map((turn): Anthropic.Beta.BetaMessageParam => ({ role: turn.role, content: turn.text.slice(0, MAX_CHARS) }))
  while (clean.length && clean[0].role !== 'user') clean.shift()
  const last = clean.at(-1)
  if (!last || last.role !== 'user') return undefined
  const songText = song ? JSON.stringify(song).slice(0, MAX_SONG_CHARS) : 'No song yet. Use new_song to write one.'
  clean[clean.length - 1] = { role: 'user', content: [{ type: 'text', text: last.content as string }, { type: 'text', text: `Current song (for reference):\n${songText}` }] }
  return clean
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Live AI is not configured.' }, 503)
  let body: { messages?: unknown; song?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send JSON.' }, 400)
  }
  const messages = toMessages(body.messages, body.song)
  if (!messages) return json({ error: 'The last message must come from the player.' }, 400)

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: SONG_TOOLS as unknown as Anthropic.Beta.BetaTool[],
      tool_choice: { type: 'auto' },
      messages,
    })
    if (response.stop_reason === 'refusal') return json({ answer: "I can't help with that one, but I can write you a song. Try \"make a punk song\".", edits: [] })
    const edits: SongEdit[] = []
    const text: string[] = []
    for (const block of response.content) {
      if (block.type === 'text') text.push(block.text)
      else if (block.type === 'tool_use') {
        const edit = editFromToolCall(block.name, block.input)
        if (edit) edits.push(edit)
      }
    }
    const answer = text.join('\n').trim()
    if (!answer && !edits.length) return json({ error: 'Empty answer.' }, 502)
    return json({ answer, edits })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Live AI is busy. Try again in a moment.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: `Live AI error ${error.status ?? ''}`.trim() }, 502)
    return json({ error: 'Live AI is unreachable.' }, 502)
  }
}
