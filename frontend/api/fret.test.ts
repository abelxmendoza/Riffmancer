// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { applyEdit } from '../src/song/edit'
import { generateSong } from '../src/song/generate'
import { editFromToolCall, SONG_TOOLS } from '../src/song/tools'
import { GET, POST } from './fret'

describe('/api/fret', () => {
  const key = process.env.ANTHROPIC_API_KEY
  afterEach(() => { if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key })

  it('reports offline without an API key so Fret falls back to the built-in brain', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(await GET().json()).toEqual({ live: false })
    expect((await POST(new Request('http://x/api/fret', { method: 'POST', body: '{}' }))).status).toBe(503)
  })

  it('rejects conversations that do not end with the player', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    const response = await POST(new Request('http://x/api/fret', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'assistant', text: 'hi' }] }) }))
    expect(response.status).toBe(400)
  })
})

describe('song tools', () => {
  it('has one tool per edit with a valid schema', () => {
    const names = SONG_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of SONG_TOOLS) {
      expect(tool.input_schema.type).toBe('object')
      for (const required of tool.input_schema.required ?? []) expect(tool.input_schema.properties).toHaveProperty(required)
    }
  })

  it('turns tool calls into edits that apply, and ignores unknown tools', () => {
    const song = generateSong('punk', { seed: 1 })
    const edit = editFromToolCall('set_drums', { kind: 'chorus', drums: { kick: 'X...X...X...X...', snare: '....X.......X...' } })
    expect(applyEdit(song, edit!).summary).toBe('rewrote the drums in every chorus')
    expect(editFromToolCall('delete_everything', {})).toBeUndefined()
    expect(editFromToolCall('set_tempo', 'fast')).toBeUndefined()
  })
})
