import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BandSong, Tick } from '../../beatmaker/conductor'
import type { AudioEngine } from '../../beatmaker/engine/AudioEngine'
import type { MixPart, SynthPart } from '../../beatmaker/engine/types'
import { getGenre, type DrumVoice, type SynthPatch } from '../../beatmaker/genres'
import { mapComputerKey, mapMidiNote, type KeyboardMode, type PlayAction } from '../../beatmaker/input/keymap'
import { MidiInput, type MidiStatus } from '../../beatmaker/input/midi'
import { ACCENT, chordNotesFor, cloneGrid, cycleVelocity, mutateGrid, NORMAL } from '../../beatmaker/pattern'
import { loadSession, saveSession, sessionForGenre, type Session } from '../../beatmaker/session'
import { chordLabel, NOTE_NAMES, noteName, SCALE_LABELS, SCALES, type ScaleName } from '../../beatmaker/theory'
import { PauseIcon, PlayIcon } from '../Icons'
import { DrumGrid } from './DrumGrid'
import { DrumPads } from './DrumPads'
import { GenrePicker } from './GenrePicker'
import { KeyboardView } from './KeyboardView'
import { Panel, Slider, Toggle } from './Slider'
import { SynthPanel } from './SynthPanel'

type Held = { action: PlayAction; notes: number[] }

const SPLITS = [48, 60, 72]

export function BeatMaker() {
  const [session, setSession] = useState<Session>(() => loadSession())
  const sessionRef = useRef(session)
  sessionRef.current = session
  const genre = getGenre(session.genreId)

  const engineRef = useRef<AudioEngine | undefined>(undefined)
  const enginePromise = useRef<Promise<AudioEngine> | undefined>(undefined)
  const [audioReady, setAudioReady] = useState(false)
  const [audioError, setAudioError] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [tick, setTick] = useState<Tick>()
  const [liveDegree, setLiveDegree] = useState<number>()
  const [fillQueued, setFillQueued] = useState(false)
  const [capture, setCapture] = useState(false)
  const captureRef = useRef(capture)
  captureRef.current = capture
  const [recordingAudio, setRecordingAudio] = useState(false)
  const [take, setTake] = useState<{ url: string; name: string }>()
  const [synthPart, setSynthPart] = useState<SynthPart>('lead')
  const [midiStatus, setMidiStatus] = useState<MidiStatus>({ state: 'pending' })
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const [activePads, setActivePads] = useState<Set<DrumVoice>>(new Set())
  const held = useRef(new Map<string, Held>())

  useEffect(() => { saveSession(session) }, [session])

  const update = useCallback((changes: Partial<Session> | ((current: Session) => Partial<Session>)) => {
    setSession((current) => ({ ...current, ...(typeof changes === 'function' ? changes(current) : changes) }))
  }, [])

  const bandSong = useCallback((): BandSong => {
    const current = sessionRef.current
    return { genre: getGenre(current.genreId), grids: current.grids, variation: current.variation, progression: current.progression, root: current.root, scale: current.scale, parts: current.parts }
  }, [])

  /** Audio can only start after a click or key press, so the engine is created on first use. */
  const ensureEngine = useCallback(async (): Promise<AudioEngine> => {
    if (engineRef.current) return engineRef.current
    if (!enginePromise.current) {
      enginePromise.current = (async () => {
        const { AudioEngine } = await import('../../beatmaker/engine/AudioEngine')
        const current = sessionRef.current
        const engine = await AudioEngine.create(bandSong, current.patches, getGenre(current.genreId).sounds.kit, (next) => setTick(next))
        engine.setTempo(current.bpm, current.swing)
        for (const [part, level] of Object.entries(current.levels)) engine.setLevel(part as MixPart, level)
        engineRef.current = engine
        setAudioReady(true)
        return engine
      })().catch((reason: unknown) => {
        enginePromise.current = undefined
        setAudioError(reason instanceof Error ? reason.message : 'Audio could not start in this browser.')
        throw reason
      })
    }
    return enginePromise.current
  }, [bandSong])

  useEffect(() => () => { engineRef.current?.dispose() }, [])

  // Keep the engine in sync with the session.
  useEffect(() => { engineRef.current?.setTempo(session.bpm, session.swing) }, [session.bpm, session.swing, audioReady])
  useEffect(() => { engineRef.current?.applyKit(genre.sounds.kit) }, [genre, audioReady])
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    for (const part of ['bass', 'chords', 'lead'] as SynthPart[]) engine.applyPatch(part, session.patches[part])
  }, [session.patches, audioReady])
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    for (const [part, level] of Object.entries(session.levels)) engine.setLevel(part as MixPart, level)
  }, [session.levels, audioReady])

  const togglePlay = useCallback(async () => {
    try {
      const engine = await ensureEngine()
      if (engine.playing) {
        engine.stop()
        setPlaying(false)
        setTick(undefined)
        setFillQueued(false)
      } else {
        engine.play()
        setPlaying(true)
      }
    } catch {
      // ensureEngine already reported the error.
    }
  }, [ensureEngine])

  const setDegree = useCallback((degree: number | undefined) => {
    if (engineRef.current) engineRef.current.conductor.liveDegree = degree
    setLiveDegree(degree)
  }, [])

  const flash = useCallback((voice: DrumVoice) => {
    setActivePads((current) => new Set(current).add(voice))
    window.setTimeout(() => setActivePads((current) => { const next = new Set(current); next.delete(voice); return next }), 120)
  }, [])

  const start = useCallback(async (source: string, action: PlayAction, velocity: number) => {
    let engine: AudioEngine
    try { engine = await ensureEngine() } catch { return }
    const current = sessionRef.current
    if (action.type === 'drum') {
      engine.hitDrum(action.voice, velocity)
      flash(action.voice)
      if (captureRef.current && engine.playing) {
        const step = engine.currentStep()
        setSession((now) => {
          const grids = { ...now.grids, [now.variation]: cloneGrid(now.grids[now.variation]) }
          grids[now.variation][action.voice][step] = velocity > 0.85 ? ACCENT : NORMAL
          return { ...now, grids }
        })
      }
      return
    }
    if (action.type === 'chord') {
      setDegree(action.degree)
      if (captureRef.current && engine.playing) {
        const slot = engine.conductor.bar % current.progression.length
        setSession((now) => ({ ...now, progression: now.progression.map((degree, index) => (index === slot ? action.degree : degree)) }))
      }
      const notes = chordNotesFor({ root: current.root, scale: current.scale, degree: action.degree }, getGenre(current.genreId).voicing)
      const bandPlaysChords = engine.playing && current.parts.chords
      if (!bandPlaysChords) engine.pressChord(notes, velocity)
      held.current.set(source, { action, notes: bandPlaysChords ? [] : notes })
      setActiveNotes((now) => new Set([...now, ...notes]))
      return
    }
    engine.pressLead(action.midi, velocity)
    held.current.set(source, { action, notes: [action.midi] })
    setActiveNotes((now) => new Set(now).add(action.midi))
  }, [ensureEngine, flash, setDegree])

  const stop = useCallback((source: string) => {
    const entry = held.current.get(source)
    if (!entry) return
    held.current.delete(source)
    const engine = engineRef.current
    if (entry.action.type === 'chord') {
      if (entry.notes.length) engine?.releaseChord(entry.notes)
      const notes = chordNotesFor({ root: sessionRef.current.root, scale: sessionRef.current.scale, degree: entry.action.degree }, getGenre(sessionRef.current.genreId).voicing)
      setActiveNotes((now) => { const next = new Set(now); notes.forEach((note) => next.delete(note)); return next })
    } else if (entry.action.type === 'lead') {
      engine?.releaseLead(entry.action.midi)
      const midi = entry.action.midi
      setActiveNotes((now) => { const next = new Set(now); next.delete(midi); return next })
    }
  }, [])

  const keymapSettings = useCallback(() => {
    const current = sessionRef.current
    return { ...current.keyboard, root: current.root, scale: current.scale }
  }, [])

  // MIDI keyboards.
  useEffect(() => {
    const midi = new MidiInput((message, deviceId) => {
      const source = `midi:${deviceId}:${message.channel}:${message.note}`
      if (message.kind === 'noteOn') void start(source, mapMidiNote(message.note, message.channel, keymapSettings()), message.velocity)
      else if (message.kind === 'noteOff') stop(source)
    }, setMidiStatus)
    void midi.connect()
    return () => midi.disconnect()
  }, [start, stop, keymapSettings])

  // Computer keyboard fallback and shortcuts.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      if (event.code === 'Space') { event.preventDefault(); void togglePlay(); return }
      const action = mapComputerKey(event.key, keymapSettings())
      if (!action) return
      event.preventDefault()
      void start(`key:${event.code}`, action, 0.85)
    }
    const up = (event: KeyboardEvent) => stop(`key:${event.code}`)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [start, stop, togglePlay, keymapSettings])

  const changeGenre = (id: string) => {
    const next = sessionForGenre(getGenre(id), sessionRef.current)
    setSession(next)
    setDegree(undefined)
  }

  const queueFill = () => {
    engineRef.current?.conductor.queueFill()
    setFillQueued(true)
  }
  useEffect(() => { if (tick?.fill || tick === undefined) setFillQueued(false) }, [tick?.fill, tick])

  const toggleRecording = async () => {
    try {
      const engine = await ensureEngine()
      if (engine.isRecording) {
        const blob = await engine.stopRecording()
        setRecordingAudio(false)
        if (take) URL.revokeObjectURL(take.url)
        const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
        setTake({ url: URL.createObjectURL(blob), name: `riffmancer-${sessionRef.current.genreId}-${sessionRef.current.bpm}bpm.${extension}` })
      } else {
        await engine.startRecording()
        setRecordingAudio(true)
      }
    } catch (reason) {
      setRecordingAudio(false)
      setAudioError(reason instanceof Error ? reason.message : 'Recording is not available in this browser.')
    }
  }

  const grid = session.grids[session.variation]
  const currentDegree = tick?.degree ?? liveDegree ?? session.progression[0]
  const chord = chordLabel(currentDegree, session.root, session.scale, genre.voicing)
  const pianoRange = useMemo(() => ({ low: session.keyboard.splitNote - 24, high: session.keyboard.splitNote + 23 }), [session.keyboard.splitNote])

  const setKeyboard = (changes: Partial<Session['keyboard']>) => update((current) => ({ keyboard: { ...current.keyboard, ...changes } }))
  const setPatch = (part: SynthPart, patch: SynthPatch) => update((current) => ({ patches: { ...current.patches, [part]: patch } }))

  return (
    <div className="space-y-6">
      <Panel title="1 · Pick a genre">
        <GenrePicker value={session.genreId} onChange={changeGenre} />
      </Panel>

      <section className="rounded-3xl border border-primary/25 bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => void togglePlay()} className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-background shadow-[0_0_30px_rgba(163,230,53,0.25)] hover:bg-secondary" aria-label={playing ? 'Stop the band' : 'Start the band'}>
            {playing ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7" />}
          </button>
          <div className="min-w-[150px]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">Now playing</p>
            <p className="font-display text-2xl font-black text-primary">{chord.name} <span className="text-base text-foreground/50">{chord.roman}</span></p>
            <p className="font-mono text-xs text-foreground/45">Bar {(tick?.bar ?? 0) + 1} · step {(tick?.step ?? 0) + 1}{tick?.fill ? ' · FILL' : ''}</p>
          </div>
          <div className="grid min-w-[220px] flex-1 grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            <Slider label="Tempo" value={session.bpm} min={60} max={240} step={1} display={`${session.bpm} BPM`} onChange={(bpm) => update({ bpm })} />
            <Slider label="Swing" value={session.swing} min={0} max={0.6} display={`${Math.round(session.swing * 100)}%`} onChange={(swing) => update({ swing })} />
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Key
              <select className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground" value={session.root} onChange={(event) => update({ root: Number(event.target.value) })}>
                {NOTE_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Mood
              <select className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-2 py-1.5 text-sm normal-case tracking-normal text-foreground" value={session.scale} onChange={(event) => update({ scale: event.target.value as ScaleName })}>
                {(Object.keys(SCALES) as ScaleName[]).map((scale) => <option key={scale} value={scale}>{SCALE_LABELS[scale]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-4">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-foreground/45">Beat</span>
          <Toggle on={session.variation === 'main'} label="A" onClick={() => update({ variation: 'main' })} title="Main groove" />
          <Toggle on={session.variation === 'alt'} label="B" onClick={() => update({ variation: 'alt' })} title="Alternate groove" />
          <Toggle on={fillQueued} label="Fill!" onClick={queueFill} title="Drum fill on the next bar, then a crash" />
          <Toggle on={false} label="Mutate" onClick={() => update((current) => ({ grids: { ...current.grids, [current.variation]: mutateGrid(current.grids[current.variation]) } }))} title="Make a variation of this beat" />
          <Toggle on={false} label="Reset" onClick={() => changeGenre(session.genreId)} title="Back to the genre preset" />
          <span className="mx-2 h-5 w-px bg-foreground/10" />
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-foreground/45">Band</span>
          {(['drums', 'bass', 'chords'] as const).map((part) => (
            <Toggle key={part} on={session.parts[part]} label={part[0].toUpperCase() + part.slice(1)} onClick={() => update((current) => ({ parts: { ...current.parts, [part]: !current.parts[part] } }))} />
          ))}
          <span className="mx-2 h-5 w-px bg-foreground/10" />
          <Toggle on={capture} label={capture ? '● Capturing' : 'Capture'} onClick={() => setCapture((value) => !value)} title="While playing, drum hits are written into the beat and chords into the progression" />
          <Toggle on={recordingAudio} label={recordingAudio ? '■ Stop recording' : '● Record audio'} onClick={() => void toggleRecording()} title="Record everything you hear to an audio file" />
          {take && <a href={take.url} download={take.name} className="rounded-full border border-secondary px-3 py-1.5 text-xs font-bold text-secondary hover:bg-secondary hover:text-background">Download take</a>}
        </div>
        {audioError && <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{audioError}</p>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="2 · Play your keyboard" actions={<MidiBadge status={midiStatus} />}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {([['band', 'Band mode'], ['synth', 'Synth only'], ['drums', 'Drum pads']] as [KeyboardMode, string][]).map(([mode, label]) => (
              <Toggle key={mode} on={session.keyboard.mode === mode} label={label} onClick={() => setKeyboard({ mode })} />
            ))}
            {session.keyboard.mode === 'band' && (
              <label className="ml-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">Split at
                <select className="rounded-lg border border-foreground/10 bg-background px-2 py-1 text-xs text-foreground" value={session.keyboard.splitNote} onChange={(event) => setKeyboard({ splitNote: Number(event.target.value) })}>
                  {SPLITS.map((note) => <option key={note} value={note}>{noteName(note)}</option>)}
                </select>
              </label>
            )}
            <Toggle on={session.keyboard.scaleLock} label="No wrong notes" onClick={() => setKeyboard({ scaleLock: !session.keyboard.scaleLock })} title="Every key snaps to the song's key" />
          </div>
          <KeyboardView
            low={pianoRange.low}
            high={pianoRange.high}
            mode={session.keyboard.mode}
            splitNote={session.keyboard.splitNote}
            root={session.root}
            scale={session.scale}
            scaleLock={session.keyboard.scaleLock}
            active={activeNotes}
            onPress={(note) => void start(`screen:${note}`, mapMidiNote(note, 0, keymapSettings()), 0.85)}
            onRelease={(note) => stop(`screen:${note}`)}
          />
          <HowTo mode={session.keyboard.mode} />
        </Panel>

        <Panel title="Drum pads">
          <DrumPads active={activePads} onHit={(voice) => void start(`pad:${voice}`, { type: 'drum', voice }, 0.9)} />
          <p className="mt-3 text-[11px] leading-5 text-foreground/40">Pads on channel 10 of any MIDI controller always play drums. Turn on Capture while the band plays to record your hits into the beat.</p>
        </Panel>
      </div>

      <Panel
        title="3 · Chord progression"
        actions={<Toggle on={liveDegree === undefined} label={liveDegree === undefined ? 'Following progression' : 'Back to progression'} onClick={() => setDegree(undefined)} title="The band follows the last chord you played. Click to go back to the loop below." />}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {session.progression.map((degree, index) => {
            const label = chordLabel(degree, session.root, session.scale, genre.voicing)
            const current = playing && liveDegree === undefined && tick !== undefined && tick.bar % session.progression.length === index
            return (
              <div key={index} className={`rounded-2xl border p-3 ${current ? 'border-primary bg-primary/10' : 'border-foreground/10 bg-background/40'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">Bar {index + 1}</p>
                <p className="font-display text-xl font-black text-foreground">{label.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((option) => (
                    <button key={option} type="button" aria-label={`Bar ${index + 1} chord ${option}`} onClick={() => update((now) => ({ progression: now.progression.map((value, slot) => (slot === index ? option : value)) }))} className={`h-6 w-6 rounded-md text-[10px] font-bold ${option === degree ? 'bg-primary text-background' : 'bg-foreground/5 text-foreground/50 hover:text-foreground'}`}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title={`4 · Drum beat ${session.variation === 'main' ? 'A' : 'B'}`}>
        <DrumGrid
          grid={grid}
          playStep={playing ? tick?.step : undefined}
          onAudition={(voice) => void start(`grid:${voice}`, { type: 'drum', voice }, 0.9)}
          onToggle={(voice, step) => update((current) => {
            const grids = { ...current.grids, [current.variation]: cloneGrid(current.grids[current.variation]) }
            grids[current.variation][voice][step] = cycleVelocity(grids[current.variation][voice][step])
            return { grids }
          })}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="5 · Synthesizer">
          <SynthPanel part={synthPart} patches={session.patches} onPart={setSynthPart} onChange={setPatch} />
        </Panel>
        <Panel title="Mixer">
          <div className="space-y-3">
            {(['drums', 'bass', 'chords', 'lead'] as MixPart[]).map((part) => (
              <Slider key={part} label={part === 'lead' ? 'Synth' : part} value={session.levels[part]} min={0} max={1} display={`${Math.round(session.levels[part] * 100)}%`} onChange={(level) => update((current) => ({ levels: { ...current.levels, [part]: level } }))} />
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-background/50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">{genre.name} tips</p>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-foreground/60">
              {genre.tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function MidiBadge({ status }: { status: MidiStatus }) {
  const text = status.state === 'ready'
    ? status.devices.length ? `MIDI: ${status.devices.map((device) => device.name).join(', ')}` : 'No MIDI keyboard found. Plug one in.'
    : status.state === 'unsupported' ? 'This browser has no Web MIDI. Use Chrome or Edge, or your computer keyboard.'
      : status.state === 'denied' ? `MIDI blocked: ${status.message}` : 'Looking for MIDI keyboards…'
  const good = status.state === 'ready' && status.devices.length > 0
  return (
    <span className={`flex items-center gap-2 text-xs font-semibold ${good ? 'text-secondary' : 'text-foreground/50'}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${good ? 'bg-secondary' : 'bg-foreground/30'}`} />{text}
    </span>
  )
}

function HowTo({ mode }: { mode: KeyboardMode }) {
  return (
    <div className="mt-4 grid gap-3 text-xs leading-5 text-foreground/55 sm:grid-cols-3">
      {mode === 'band' && (
        <>
          <p><strong className="text-foreground">Left of the split</strong> plays chords. Each white key is a chord that fits the song, and the band follows whatever you press.</p>
          <p><strong className="text-foreground">Right of the split</strong> plays the synthesizer. With "No wrong notes" on, every key lands in the song's key.</p>
        </>
      )}
      {mode === 'synth' && <p className="sm:col-span-2"><strong className="text-foreground">Every key plays the synthesizer</strong>, so you can jam a melody over the band. Change the sound in the Synthesizer panel.</p>}
      {mode === 'drums' && <p className="sm:col-span-2"><strong className="text-foreground">Every key is a drum.</strong> C is the kick, D the snare, F♯ the hi-hat, A the crash. GM drum notes work too.</p>}
      <p><strong className="text-foreground">No MIDI keyboard?</strong> Use 1–8 for drums, Z–M for chords, A–' for the synth, and Space to start or stop.</p>
    </div>
  )
}
