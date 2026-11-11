// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { GET, POST } from './chat'

describe('/api/chat', () => {
  const key = process.env.ANTHROPIC_API_KEY
  afterEach(() => { if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key })

  it('reports offline without an API key so the chat falls back to the built-in brain', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(await GET().json()).toEqual({ live: false })
    const response = await POST(new Request('http://x/api/chat', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(503)
  })

  it('rejects conversations that do not end with the player', async () => {
    process.env.ANTHROPIC_API_KEY = 'test'
    const response = await POST(new Request('http://x/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'assistant', text: 'hi' }] }) }))
    expect(response.status).toBe(400)
  })
})
