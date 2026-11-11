import { useCallback, useEffect, useRef, useState } from 'react'
import { dispatchBeat, getBeatStatus, subscribeBeatStatus, type BeatStatus } from '../../assistant/bus'
import { chipsFor, respond, type Mood } from '../../assistant/engine'
import { askLive, probeLive, type LiveState } from '../../assistant/live'
import { ASSISTANT_NAME, GREETING } from '../../assistant/persona'
import { getGenre } from '../../beatmaker/genres'
import { NOTE_NAMES } from '../../beatmaker/theory'
import { hrefFor, type Route } from '../../lib/route'
import { FretBot } from './FretBot'

interface ChatMessage {
  id: number
  from: 'user' | 'bot'
  text: string
  live?: boolean
  pending?: boolean
}

const STORAGE_KEY = 'riffmancer.assistant.messages'

function loadMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ChatMessage[]).filter((message) => !message.pending).slice(-40) : []
  } catch {
    return []
  }
}

const SUBTITLE: Record<LiveState, string> = {
  checking: 'Tuning up…',
  live: 'Live AI on · runs the band for you',
  offline: 'Built-in brain · runs the band for you',
}

/** Wrench-style chat bar: an oval composer pinned to the bottom with the mascot's head as the toggle. */
export function ChatBar({ route }: { route: Route }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<{ mood: Mood; until: number }>()
  const [beat, setBeat] = useState<BeatStatus>(getBeatStatus)
  const [live, setLive] = useState<LiveState>('checking')
  const nextId = useRef(Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => subscribeBeatStatus(setBeat), [])
  useEffect(() => { void probeLive().then((ok) => setLive(ok ? 'live' : 'offline')) }, [])
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter((message) => !message.pending).slice(-40))) } catch { /* storage blocked */ }
  }, [messages])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, open])
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(undefined), Math.max(0, flash.until - Date.now()))
    return () => window.clearTimeout(timer)
  }, [flash])

  const mood: Mood = busy ? 'thinking' : flash ? flash.mood : draft.trim() ? 'listening' : beat.playing ? 'rocking' : 'idle'

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setOpen(true)
    setDraft('')
    const userMessage: ChatMessage = { id: nextId.current++, from: 'user', text }
    setMessages((current) => [...current, userMessage])
    const status = getBeatStatus()
    const reply = respond(text, { route, beat: status })

    if (reply.unknown && live === 'live') {
      const pendingId = nextId.current++
      setMessages((current) => [...current, { id: pendingId, from: 'bot', text: 'Thinking…', pending: true }])
      setBusy(true)
      try {
        const history = [...messages, userMessage].filter((message) => !message.pending).map((message) => ({ role: message.from === 'user' ? 'user' as const : 'assistant' as const, text: message.text }))
        const genre = getGenre(status.genreId)
        const answer = await askLive(history, { page: route, genre: genre.name, bpm: status.bpm, key: `${NOTE_NAMES[status.root]} ${status.scale}`, playing: status.playing })
        setMessages((current) => current.map((message) => (message.id === pendingId ? { id: pendingId, from: 'bot', text: answer, live: true } : message)))
        setFlash({ mood: 'ready', until: Date.now() + 2400 })
      } catch {
        setMessages((current) => current.map((message) => (message.id === pendingId ? { id: pendingId, from: 'bot', text: reply.text } : message)))
        setFlash({ mood: 'confused', until: Date.now() + 3000 })
      } finally {
        setBusy(false)
      }
      return
    }

    if (reply.navigate && reply.navigate !== route) window.location.hash = hrefFor(reply.navigate)
    for (const action of reply.actions) dispatchBeat(action)
    setMessages((current) => [...current, { id: nextId.current++, from: 'bot', text: reply.text }])
    setFlash({ mood: reply.mood, until: Date.now() + (reply.mood === 'confused' ? 3000 : 2400) })
  }, [busy, live, messages, route])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft) }
    if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const chips = chipsFor(route, beat)

  return (
    <div className="chat-bar fixed bottom-4 left-1/2 z-50 w-[min(760px,calc(100vw-24px))] -translate-x-1/2">
      {open && (
        <section aria-label={`Chat with ${ASSISTANT_NAME}`} className="mb-3 flex max-h-[min(56dvh,560px)] flex-col overflow-hidden rounded-[20px] border border-foreground/15 bg-surface shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <header className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
            <FretBot mood={mood} size={38} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-black uppercase tracking-wider text-foreground">{ASSISTANT_NAME}</p>
              <p className="truncate text-[11px] text-foreground/50">{SUBTITLE[live]}</p>
            </div>
            <button type="button" onClick={() => setMessages([])} className="rounded-full px-3 py-1.5 text-[11px] font-bold text-foreground/55 hover:bg-foreground/5 hover:text-foreground">New chat</button>
            <button type="button" aria-label="Collapse chat" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-foreground/60 hover:bg-foreground/5 hover:text-foreground">▾</button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex gap-3">
                <FretBot mood="ready" size={28} still />
                <p className="max-w-[85%] rounded-xl rounded-bl-sm border border-foreground/10 bg-background/60 px-3 py-2 text-sm leading-6 text-foreground/85">{GREETING}</p>
              </div>
            )}
            {messages.map((message) => message.from === 'user' ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm font-semibold leading-6 text-background">{message.text}</p>
              </div>
            ) : (
              <div key={message.id} className="flex gap-3">
                <FretBot mood={message.pending ? 'thinking' : 'idle'} size={28} still />
                <div className={`max-w-[85%] rounded-xl rounded-bl-sm border border-foreground/10 bg-background/60 px-3 py-2 text-sm leading-6 ${message.pending ? 'text-foreground/45' : 'text-foreground/85'}`}>
                  {message.live && <span className="mb-1 inline-block rounded-full border border-secondary/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-secondary">Live AI</span>}
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-foreground/10 px-4 py-3">
            {chips.map((chip) => (
              <button key={chip} type="button" onClick={() => void send(chip)} className="shrink-0 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:border-primary hover:bg-primary hover:text-background">{chip}</button>
            ))}
          </div>
        </section>
      )}
      <div className="flex items-end gap-2 rounded-[28px] border border-foreground/20 bg-surface px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.55)] focus-within:border-primary">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? `Hide ${ASSISTANT_NAME}` : `Talk to ${ASSISTANT_NAME}`} aria-expanded={open} className="-mt-4 shrink-0 drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
          <FretBot mood={mood} size={42} />
        </button>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-hidden="true" tabIndex={-1} className="hidden h-9 w-6 shrink-0 text-foreground/45 hover:text-foreground sm:block">{open ? '▾' : '▴'}</button>
        <label className="sr-only" htmlFor="fret-input">Message {ASSISTANT_NAME}</label>
        <textarea
          id="fret-input"
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={`Ask ${ASSISTANT_NAME}: "make a metal beat", "faster", "add a fill"…`}
          onChange={(event) => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(160, event.target.scrollHeight)}px` }}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => event.stopPropagation()}
          onFocus={() => { if (messages.length === 0) setOpen(true) }}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-base text-foreground placeholder:text-foreground/35 focus:outline-none sm:text-sm"
        />
        <button type="button" onClick={() => void send(draft)} disabled={!draft.trim() || busy} aria-label="Send" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-primary text-lg font-black text-background transition hover:bg-secondary disabled:opacity-40">↑</button>
      </div>
    </div>
  )
}
