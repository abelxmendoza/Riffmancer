import { useCallback, useEffect, useRef, useState } from 'react'
import { dispatchStudio, OPEN_ASSISTANT_EVENT, publishBeatStatus, registerSongPromptHandler, type StudioAction } from '../../assistant/bus'
import type { Mood } from '../../assistant/engine'
import { askSongLive, probeSongLive } from '../../assistant/liveSong'
import type { LiveState } from '../../assistant/live'
import { ASSISTANT_NAME } from '../../assistant/persona'
import { describeOutcome, genreButtons, respondSong, vocalPresetForSong, type PlayCommand } from '../../assistant/songBrain'
import { sendToStudio } from '../../studio/storage'
import { applyEdits, type SongEdit } from '../../song/edit'
import { generateSong } from '../../song/generate'
import { commit, currentVersion, goTo, loadHistory, redo, saveHistory, undo, type SongHistory } from '../../song/history'
import { sectionName, type SongSpec } from '../../song/spec'
import { FretBot } from '../assistant/FretBot'
import { SongCard } from './SongCard'
import { UnderTheHood } from './UnderTheHood'
import { useSongPlayer } from './useSongPlayer'

interface ChatMessage {
  id: number
  from: 'user' | 'bot'
  text: string
  live?: boolean
  pending?: boolean
}

const MESSAGES_KEY = 'riffmancer.create.messages'

function loadMessages(): ChatMessage[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(MESSAGES_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as ChatMessage[]).filter((message) => !message.pending).slice(-40) : []
  } catch {
    return []
  }
}

const DESCRIBE_IDEAS = [
  'Shoegaze song with fuzzy wide guitars and a deep sub bass',
  'Dark trap beat with a gliding 808 and glassy bells',
  'Synthwave song at 110 with lush pads and roomy drums',
  'Doom song with huge fuzz guitars',
]

const QUICK_ASKS = ['Heavier', 'Faster', 'New drums', 'Fuzzier guitars', 'Deep 808 bass', 'Roomy live drums', 'Another chorus', 'Half-time breakdown', 'Surprise me']

/** The main screen: talk to Fret, Fret writes and edits the song. Manual controls live under the hood. */
export function CreateScreen() {
  const [history, setHistory] = useState<SongHistory>(loadHistory)
  const historyRef = useRef(history)
  historyRef.current = history
  const song = currentVersion(history)?.song
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<LiveState>('checking')
  const [flash, setFlash] = useState<Mood>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<number>()
  const nextId = useRef(Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const player = useSongPlayer(song)

  useEffect(() => { saveHistory(history) }, [history])
  useEffect(() => {
    try { window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.filter((message) => !message.pending).slice(-40))) } catch { /* storage blocked */ }
  }, [messages])
  useEffect(() => { void probeSongLive().then((ok) => setLive(ok ? 'live' : 'offline')) }, [])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])
  useEffect(() => {
    if (song) publishBeatStatus({ ready: true, playing: player.playing, genreId: song.genreId, bpm: song.bpm, root: song.root, scale: song.scale })
  }, [song, player.playing])

  const mood: Mood = busy ? 'thinking' : flash ?? (draft.trim() ? 'listening' : player.playing ? 'rocking' : 'idle')

  const addBot = (text: string, extra: Partial<ChatMessage> = {}) => setMessages((current) => [...current, { id: nextId.current++, from: 'bot', text, ...extra }])

  /** Applies edits as one new version. Returns the new song (or the old one if nothing changed). */
  const runEdits = useCallback((edits: SongEdit[], base: SongSpec | undefined): { song: SongSpec | undefined; text: string } => {
    if (!edits.length) return { song: base, text: '' }
    const outcome = applyEdits(base ?? generateSong('post-punk', { title: 'Untitled' }), edits)
    if (!outcome.summaries.length) return { song: base, text: describeOutcome([], outcome.errors) }
    const note = outcome.summaries.join(', ')
    setHistory((current) => commit(current, outcome.song, note))
    return { song: outcome.song, text: describeOutcome(outcome.summaries, outcome.errors) }
  }, [])

  const runPlay = useCallback((command: PlayCommand | undefined, current: SongSpec | undefined) => {
    if (!command || !current) return
    if (command.type === 'stop') { player.stop(); return }
    const index = command.section ? command.section - 1 : 0
    if (command.type === 'loop') { player.setLoopSection(index); setSelected(index) } else if (command.section) setSelected(index)
    void player.play(index)
  }, [player])

  /** Records the song once in real time, hands it to the Studio with a fitting vocal preset, and opens the Studio. */
  const singOver = useCallback(async (current: SongSpec, actions?: StudioAction[]) => {
    const vocal = actions ?? [{ type: 'genre', id: current.genreId }, { type: 'tempo', bpm: current.bpm }, vocalPresetForSong(current).action] satisfies StudioAction[]
    try {
      const blob = await player.bounce()
      await sendToStudio(`${current.title} (instrumental)`, blob)
      for (const action of vocal) dispatchStudio(action)
      window.location.hash = '#/studio'
    } catch (reason) {
      addBot(`Didn't make it to the Studio: ${reason instanceof Error ? reason.message : 'recording failed'}`)
      setFlash('confused')
    }
  }, [player]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setDraft('')
    const userMessage: ChatMessage = { id: nextId.current++, from: 'user', text }
    setMessages((current) => [...current, userMessage])
    const base = currentVersion(historyRef.current)?.song
    const reply = respondSong(text, base)

    if (reply.unknown && live === 'live') {
      const pendingId = nextId.current++
      setMessages((current) => [...current, { id: pendingId, from: 'bot', text: 'Thinking…', pending: true }])
      setBusy(true)
      try {
        const turns = [...messages, userMessage].filter((message) => !message.pending).map((message) => ({ role: message.from === 'user' ? 'user' as const : 'assistant' as const, text: message.text }))
        const answer = await askSongLive(turns, base)
        const result = runEdits(answer.edits, base)
        const body = [answer.answer, answer.edits.length && !answer.answer ? result.text : ''].filter(Boolean).join(' ') || result.text || 'Done.'
        setMessages((current) => current.map((message) => (message.id === pendingId ? { id: pendingId, from: 'bot', text: body, live: true } : message)))
        setFlash('ready')
        if (answer.edits.length && result.song) runPlay({ type: 'play' }, result.song)
      } catch {
        setMessages((current) => current.map((message) => (message.id === pendingId ? { id: pendingId, from: 'bot', text: reply.text } : message)))
        setFlash('confused')
      } finally {
        setBusy(false)
      }
      return
    }

    if (reply.studio || reply.sendToStudio) {
      addBot(reply.text)
      setFlash(reply.mood)
      if (reply.sendToStudio && base) void singOver(base, reply.studio)
      else reply.studio?.filter((action) => action.type === 'customPreset').forEach(dispatchStudio)
      return
    }

    if (reply.history) {
      setHistory((current) => (reply.history === 'undo' ? undo(current) : redo(current)))
      addBot(reply.text)
      return
    }
    const result = runEdits(reply.edits, base)
    const isNew = reply.edits.some((edit) => edit.type === 'new_song')
    const body = isNew && result.song ? `${reply.text.replace(/song coming up(.*?)\./, `song$1: "${result.song.title}".`)}` : result.text || reply.text
    addBot(body)
    setFlash(reply.mood)
    if (isNew) { player.setLoopSection(undefined); setSelected(undefined) }
    runPlay(reply.play, result.song ?? base)
  }, [busy, live, messages, player, runEdits, runPlay, singOver])

  const sendRef = useRef(send)
  sendRef.current = send
  useEffect(() => registerSongPromptHandler((text) => void sendRef.current(text)), [])
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    window.addEventListener(OPEN_ASSISTANT_EVENT, focus)
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, focus)
  }, [])

  const handEdit = useCallback((edit: SongEdit, note: string) => {
    const base = currentVersion(historyRef.current)?.song
    if (!base) return
    const outcome = applyEdits(base, [edit])
    if (outcome.summaries.length) setHistory((current) => commit(current, outcome.song, note, true))
  }, [])

  const handSong = useCallback((next: SongSpec, note: string) => setHistory((current) => commit(current, next, note, true)), [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft) }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {song ? (
        <>
          <SongCard
            song={song}
            history={history}
            playing={player.playing}
            position={player.position}
            selected={selected}
            loopSection={player.loopSection}
            drawerOpen={drawerOpen}
            onPlay={() => (player.playing ? player.stop() : void player.play(0))}
            onSelect={(index) => setSelected((current) => (current === index ? undefined : index))}
            onPlayFrom={(index) => void player.play(index)}
            onLoop={(index) => { player.setLoopSection(index); if (index !== undefined) void player.play(index) }}
            onAskAbout={(index) => { setDraft(`In ${sectionName(song, index).toLowerCase()}, `); inputRef.current?.focus() }}
            onUndo={() => setHistory(undo)}
            onRedo={() => setHistory(redo)}
            onVersion={(index) => setHistory((current) => goTo(current, index))}
            onToggleDrawer={() => setDrawerOpen((open) => !open)}
            bouncing={player.bouncing}
            onSingOver={() => { if (player.bouncing) player.stop(); else { addBot(`🎤 Recording "${song.title}" into the Studio. It plays through once, then the Studio opens with a vocal preset that fits.`); void singOver(song) } }}
          />
          {player.error && <p role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{player.error}</p>}
        </>
      ) : (
        <section className="flex flex-col items-center rounded-3xl border border-foreground/10 bg-surface px-5 py-10 text-center">
          <FretBot mood={mood} size={120} />
          <h1 className="mt-4 font-display text-3xl font-black uppercase text-foreground sm:text-4xl">What are we making?</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-foreground/60">Tell {ASSISTANT_NAME} what you want to hear. You get a whole song, then {ASSISTANT_NAME} changes anything you ask. No production skills needed.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {genreButtons().map((genre) => (
              <button key={genre.id} type="button" onClick={() => void send(genre.prompt)} className="rounded-full border border-primary/40 px-4 py-2 text-sm font-black text-foreground hover:bg-primary hover:text-background">{genre.label}</button>
            ))}
            <button type="button" onClick={() => void send('Surprise me')} className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-black text-foreground/70 hover:border-secondary hover:text-foreground">Surprise me</button>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-foreground/40">Or describe it in your own words</p>
          <div className="mt-2 flex max-w-xl flex-wrap justify-center gap-2">
            {DESCRIBE_IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => void send(idea)} className="rounded-2xl border border-foreground/10 px-3 py-2 text-left text-xs text-foreground/70 hover:border-primary hover:text-foreground">“{idea}”</button>
            ))}
          </div>
        </section>
      )}

      <section aria-label={`Chat with ${ASSISTANT_NAME}`} className="flex flex-col rounded-3xl border border-foreground/10 bg-surface">
        <header className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3">
          <FretBot mood={mood} size={36} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-black uppercase tracking-wider text-foreground">{ASSISTANT_NAME}</p>
            <p className="truncate text-[11px] text-foreground/50">{live === 'live' ? 'Live AI on · understands anything you ask' : 'Built-in brain · writes and edits your song'}</p>
          </div>
          {messages.length > 0 && <button type="button" onClick={() => setMessages([])} className="rounded-full px-3 py-1.5 text-[11px] font-bold text-foreground/55 hover:bg-foreground/5 hover:text-foreground">Clear chat</button>}
        </header>
        <div ref={listRef} className="max-h-[44dvh] min-h-24 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex gap-3">
              <FretBot mood="ready" size={28} still />
              <p className="max-w-[85%] rounded-xl rounded-bl-sm border border-foreground/10 bg-background/60 px-3 py-2 text-sm leading-6 text-foreground/85">
                {song ? `"${song.title}" is loaded. Ask me for anything: "heavier chorus", "new drums", "add a bridge", "faster", or "undo".` : 'Pick a genre above or just tell me, like "make me a dark post punk song" or "drum and bass at 174".'}
              </p>
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
        {song && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-foreground/10 px-4 py-3">
            {QUICK_ASKS.map((chip) => (
              <button key={chip} type="button" onClick={() => void send(chip)} disabled={busy} className="shrink-0 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:border-primary hover:bg-primary hover:text-background disabled:opacity-40">{chip}</button>
            ))}
          </div>
        )}
        <div className="m-3 mt-0 flex items-end gap-2 rounded-[24px] border border-foreground/20 bg-background px-3 py-2 focus-within:border-primary">
          <label className="sr-only" htmlFor="create-input">Message {ASSISTANT_NAME}</label>
          <textarea
            id="create-input"
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={song ? 'Tell Fret what to change…' : 'Tell Fret what to make…'}
            onChange={(event) => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(160, event.target.scrollHeight)}px` }}
            onKeyDown={onKeyDown}
            onKeyUp={(event) => event.stopPropagation()}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-base text-foreground placeholder:text-foreground/35 focus:outline-none sm:text-sm"
          />
          <button type="button" onClick={() => void send(draft)} disabled={!draft.trim() || busy} aria-label="Send" className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-primary text-lg font-black text-background transition hover:bg-secondary disabled:opacity-40">↑</button>
        </div>
      </section>
      {song && drawerOpen && (
        <UnderTheHood
          song={song}
          section={selected ?? 0}
          playStep={player.position && player.position.sectionIndex === (selected ?? 0) ? player.position.step : undefined}
          onSection={setSelected}
          onEdit={handEdit}
          onSong={handSong}
          onAudition={(voice) => void player.audition(voice)}
        />
      )}
    </div>
  )
}
