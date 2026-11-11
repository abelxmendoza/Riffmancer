import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publishStudioStatus, registerStudioHandler, type StudioAction } from '../../assistant/bus'
import { GENRES } from '../../beatmaker/genres'
import type { StudioEngine } from '../../studio/engine/StudioEngine'
import {
  activeTake, addInstrumentalTrack, addTakes, addVocalTrack, applyMasterPreset, applyPreset, armedTrack, createProject, MAX_TRACKS, moveClip, newId,
  projectDuration, removeClip, removeTake, removeTrack, ROLE_NAMES, setActiveTake, setGenre, updateChain, updateTrack, type StudioProject, type Take, type Track, type VocalRole,
} from '../../studio/project'
import { loadAudio, loadProject, pruneAudio, saveAudio, saveProject, takeInbox, type StoredAudio } from '../../studio/storage'
import { barBeat, clock, estimateLatencyMs, secondsPerBar } from '../../studio/timing'
import { PauseIcon, PlayIcon, UploadIcon } from '../Icons'
import { Panel, Slider, Toggle } from '../beatmaker/Slider'
import { FxPanel, MasterPanel } from './FxPanel'
import { Timeline } from './Timeline'
import { LevelMeter } from './Waveform'

type EngineModule = typeof import('../../studio/engine/StudioEngine')
type MixModule = typeof import('../../studio/engine/mixdown')

const AUDIO_TYPES = /^audio\/|\.(wav|mp3|m4a|aac|flac|ogg|oga|opus|aif|aiff|webm)$/i
const MAX_IMPORT_BYTES = 300 * 1024 * 1024

function micError(reason: unknown): string {
  const name = reason instanceof DOMException ? reason.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked. Click the mic or lock icon in the address bar, allow the microphone, and try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found. Plug one in (or pick another input in Settings) and try again.'
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.'
  return reason instanceof Error ? reason.message : 'Recording failed.'
}

/**
 * The Studio: record vocals over an instrumental. Multitrack timeline, stacked takes, loop
 * recording, genre vocal chains, a master bus and WAV export, all in the browser.
 */
export function Studio() {
  const [project, setProject] = useState<StudioProject>(() => createProject())
  const projectRef = useRef(project)
  projectRef.current = project
  const [loaded, setLoaded] = useState(false)
  const buffers = useRef(new Map<string, AudioBuffer>())
  const [bufferVersion, setBufferVersion] = useState(0)
  const engineModule = useRef<Promise<EngineModule> | undefined>(undefined)
  const engineRef = useRef<StudioEngine | undefined>(undefined)
  const enginePromise = useRef<Promise<StudioEngine> | undefined>(undefined)
  const [audioReady, setAudioReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [playhead, setPlayhead] = useState(0)
  const playheadRef = useRef(0)
  playheadRef.current = playhead
  const [selectedTrackId, setSelectedTrackId] = useState<string>()
  const [selectedClip, setSelectedClip] = useState<{ trackId: string; clipId: string }>()
  const [zoom, setZoom] = useState(28)
  const [levels, setLevels] = useState({ master: -Infinity, mic: -Infinity })
  const [showSettings, setShowSettings] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string>()
  const deviceIdRef = useRef<string | undefined>(undefined)
  deviceIdRef.current = deviceId
  const [addRole, setAddRole] = useState<VocalRole>('double')
  const fileInput = useRef<HTMLInputElement>(null)
  const playheadLine = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  const loadEngineModule = useCallback(() => (engineModule.current ??= import('../../studio/engine/StudioEngine')), [])

  const addBuffer = useCallback((audioId: string, buffer: AudioBuffer) => {
    buffers.current.set(audioId, buffer)
    engineRef.current?.addBuffer(audioId, buffer)
    setBufferVersion((value) => value + 1)
  }, [])

  // Open the saved session and decode its audio.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadProject().catch(() => undefined)
      if (cancelled) return
      if (saved) setProject(saved)
      setLoaded(true)
      const current = saved ?? projectRef.current
      setSelectedTrackId(armedTrack(current)?.id ?? current.tracks[0]?.id)
      const ids = new Set(current.tracks.flatMap((track) => track.clips.flatMap((clip) => clip.takes.map((take) => take.audioId))))
      if (!ids.size) return
      const { decodeStored } = await loadEngineModule()
      for (const id of ids) {
        try {
          const stored = await loadAudio(id)
          if (stored && !cancelled) addBuffer(id, await decodeStored(stored))
        } catch {
          if (!cancelled) setError('Some audio in this session could not be loaded from the browser\'s storage.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [addBuffer, loadEngineModule])

  // Last-chance save when the tab is hidden or closed.
  useEffect(() => {
    if (!loaded) return
    const flush = () => { void saveProject(projectRef.current).catch(() => undefined) }
    window.addEventListener('pagehide', flush)
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVisibility) }
  }, [loaded])

  // Autosave (local only).
  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => { void saveProject(project).catch(() => setError('Could not save the session in this browser. Is storage full or blocked?')) }, 400)
    return () => window.clearTimeout(timer)
  }, [project, loaded])

  useEffect(() => { engineRef.current?.sync(project) }, [project])

  const ensureEngine = useCallback(async (): Promise<StudioEngine> => {
    if (engineRef.current) return engineRef.current
    enginePromise.current ??= (async () => {
      const { StudioEngine } = await loadEngineModule()
      const engine = await StudioEngine.create(projectRef.current)
      for (const [id, buffer] of buffers.current) engine.addBuffer(id, buffer)
      engineRef.current = engine
      if (projectRef.current.latencyMs === 0) {
        const raw = engine.context.rawContext as unknown as { baseLatency?: number; outputLatency?: number }
        const latencyMs = estimateLatencyMs(raw.baseLatency, raw.outputLatency)
        setProject((current) => ({ ...current, latencyMs }))
      }
      setAudioReady(true)
      return engine
    })()
    try {
      return await enginePromise.current
    } catch (reason) {
      enginePromise.current = undefined
      throw reason
    }
  }, [loadEngineModule])

  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = undefined }, [])

  // Playhead animation and meters.
  useEffect(() => {
    let frame = 0
    let lastLevels = 0
    const loop = (time: number) => {
      const engine = engineRef.current
      const seconds = engine && (engine.playing || engine.isRecording) ? engine.position : playheadRef.current
      if (playheadLine.current) playheadLine.current.style.transform = `translateX(${seconds * zoom}px)`
      if (clockRef.current) clockRef.current.textContent = `${clock(seconds)} · bar ${barBeat(seconds, projectRef.current.bpm, projectRef.current.beatsPerBar)}`
      if (engine && time - lastLevels > 60) { lastLevels = time; setLevels(engine.levels()) }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [zoom])

  const update = useCallback((change: (current: StudioProject) => StudioProject) => setProject((current) => change(current)), [])

  // ---- Transport ----
  const play = useCallback(async () => {
    try {
      const engine = await ensureEngine()
      engine.play(playheadRef.current)
      setPlaying(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Audio could not start.')
    }
  }, [ensureEngine])

  const stopRecordingRef = useRef<() => Promise<void>>(async () => {})

  const stop = useCallback(async () => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.isRecording) { await stopRecordingRef.current(); return }
    engine.stop()
    setPlaying(false)
  }, [])

  const record = useCallback(async () => {
    setError(undefined)
    const current = projectRef.current
    const track = armedTrack(current)
    if (!track) { setError('Arm a vocal track first: press its red ● button.'); return }
    try {
      const engine = await ensureEngine()
      await engine.record(current, playheadRef.current, deviceIdRef.current)
      setRecording(true)
      setPlaying(true)
      setSelectedTrackId(track.id)
      if (!devices.length) void navigator.mediaDevices?.enumerateDevices?.().then((list) => setDevices(list.filter((device) => device.kind === 'audioinput'))).catch(() => undefined)
    } catch (reason) {
      setError(micError(reason))
    }
  }, [devices.length, ensureEngine])

  stopRecordingRef.current = async () => {
    const engine = engineRef.current
    if (!engine) return
    setRecording(false)
    setPlaying(false)
    setBusy('Saving take…')
    try {
      const result = await engine.stopRecording()
      if (!result) { setNotice('That take was too short to keep.'); return }
      const track = projectRef.current.tracks.find((candidate) => candidate.id === result.trackId)
      const existing = track?.clips.reduce((count, clip) => count + clip.takes.length, 0) ?? 0
      const takes: Take[] = []
      for (const [index, samples] of result.passes.entries()) {
        const audioId = newId('audio')
        const stored: StoredAudio = { kind: 'pcm', sampleRate: result.sampleRate, channels: [samples] }
        await saveAudio(audioId, stored).catch(() => setError('The take is playable but could not be saved in this browser (storage full?).'))
        const buffer = engine.context.createBuffer(1, samples.length, result.sampleRate)
        buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
        addBuffer(audioId, buffer)
        takes.push({ id: newId('take'), audioId, duration: samples.length / result.sampleRate, name: `Take ${existing + index + 1}`, createdAt: Date.now() })
      }
      // Saved right away (not debounced) so a take survives an immediate reload or closed tab.
      const next = addTakes(projectRef.current, result.trackId, result.start, takes)
      projectRef.current = next
      setProject(next)
      void saveProject(next).catch(() => undefined)
      setNotice(takes.length > 1 ? `Saved ${takes.length} takes from the loop. Click the clip to pick the best one.` : `Saved ${takes[0].name}.`)
    } finally {
      setBusy(undefined)
    }
  }

  const toggleRecord = useCallback(() => { if (engineRef.current?.isRecording) void stopRecordingRef.current(); else void record() }, [record])
  const togglePlay = useCallback(() => { if (engineRef.current?.playing || engineRef.current?.isRecording) void stop(); else void play() }, [play, stop])

  const seek = useCallback((seconds: number) => {
    setPlayhead(seconds)
    playheadRef.current = seconds
    const engine = engineRef.current
    if (engine?.playing && !engine.isRecording) engine.play(seconds)
  }, [])

  // ---- Import ----
  const importFiles = useCallback(async (files: File[] | { name: string; blob: Blob }[]) => {
    setError(undefined)
    const { decodeStored } = await loadEngineModule()
    for (const file of files) {
      const name = 'blob' in file ? file.name : file.name
      const blob = 'blob' in file ? file.blob : file
      if (!AUDIO_TYPES.test(blob.type) && !AUDIO_TYPES.test(name)) { setError(`"${name}" isn't an audio file. Use WAV, MP3, M4A, FLAC or OGG.`); continue }
      if (blob.size > MAX_IMPORT_BYTES) { setError(`"${name}" is over 300 MB. Export a shorter or compressed version.`); continue }
      if (projectRef.current.tracks.length >= MAX_TRACKS) { setError(`The Studio holds up to ${MAX_TRACKS} tracks.`); break }
      setBusy(`Importing ${name}…`)
      try {
        const stored: StoredAudio = { kind: 'file', name, blob }
        const buffer = await decodeStored(stored)
        const audioId = newId('audio')
        await saveAudio(audioId, stored).catch(() => setError('Imported, but the browser could not store the file for next time.'))
        addBuffer(audioId, buffer)
        const label = name.replace(/\.[^.]+$/, '') || 'Instrumental'
        const current = projectRef.current
        const added = addInstrumentalTrack(current, label, audioId, buffer.duration)
        const next = current.name === 'Untitled session' && !projectDuration(current) ? { ...added, name: label } : added
        projectRef.current = next
        setProject(next)
        void saveProject(next).catch(() => undefined)
        setNotice(`Imported "${label}" (${clock(buffer.duration)}). Arm a vocal track and hit Record.`)
      } catch {
        setError(`Couldn't read "${name}". It may be damaged or in a format this browser can't play. Try WAV or MP3.`)
      } finally {
        setBusy(undefined)
      }
    }
  }, [addBuffer, loadEngineModule])

  // Bounces sent from the Beat Maker.
  useEffect(() => {
    if (!loaded) return
    void takeInbox().then((items) => { if (items.length) void importFiles(items) }).catch(() => undefined)
  }, [loaded, importFiles])

  // ---- Export ----
  const mixModule = useRef<Promise<MixModule> | undefined>(undefined)
  const exportAudio = useCallback(async (what: 'mix' | 'stems') => {
    setError(undefined)
    try {
      // Finish a take in progress first, so it's saved and included in the export.
      if (engineRef.current?.isRecording) await stopRecordingRef.current()
      await ensureEngine()
      const engine = engineRef.current!
      engine.stop()
      setPlaying(false)
      const mix = await (mixModule.current ??= import('../../studio/engine/mixdown'))
      setBusy(what === 'mix' ? 'Rendering the mix…' : 'Rendering stems…')
      const result = what === 'mix'
        ? await mix.exportMix(projectRef.current, engine.buffers)
        : await mix.exportStems(projectRef.current, engine.buffers, (done, total) => setBusy(`Rendering stems… ${done}/${total}`))
      mix.download(result.blob, result.name)
      setNotice(`Exported ${result.name}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed.')
    } finally {
      setBusy(undefined)
    }
  }, [ensureEngine])

  // ---- Track editing ----
  const selectedTrack = project.tracks.find((track) => track.id === selectedTrackId) ?? project.tracks[0]
  const onTrack = useCallback((id: string, changes: Partial<Track>) => {
    update((current) => updateTrack(current, id, changes))
    // Monitoring needs live audio and the mic, so start both when it's switched on.
    if (changes.monitor) {
      void (async () => {
        try {
          const engine = await ensureEngine()
          await engine.openMic(deviceIdRef.current)
          engine.sync(projectRef.current)
        } catch (reason) {
          setError(micError(reason))
        }
      })()
    }
  }, [ensureEngine, update])
  const onRemoveTrack = useCallback((id: string) => {
    const track = projectRef.current.tracks.find((candidate) => candidate.id === id)
    if (track?.clips.length && !window.confirm(`Delete "${track.name}" and its recordings?`)) return
    const next = removeTrack(projectRef.current, id)
    setProject(next)
    void saveProject(next).then(() => pruneAudio(next)).catch(() => undefined)
  }, [])

  const addTrack = useCallback((role: VocalRole) => {
    setProject((current) => {
      const next = addVocalTrack(current, role)
      const added = next.tracks[next.tracks.length - 1]
      if (added && added !== current.tracks[current.tracks.length - 1]) setSelectedTrackId(added.id)
      return next
    })
  }, [])

  const applyToSelected = useCallback((presetId: string) => {
    const current = projectRef.current
    const target = current.tracks.find((track) => track.id === selectedTrackId && track.kind === 'vocal') ?? armedTrack(current) ?? current.tracks.find((track) => track.kind === 'vocal')
    if (target) setProject(applyPreset(current, target.id, presetId))
  }, [selectedTrackId])

  const newSession = useCallback(() => {
    if (projectDuration(projectRef.current) > 0 && !window.confirm('Start a new session? The current one and its recordings will be cleared from this browser. Export first if you want to keep them.')) return
    engineRef.current?.stop()
    const next = createProject(projectRef.current.genre)
    setProject(next)
    setSelectedTrackId(next.tracks[0].id)
    setSelectedClip(undefined)
    setPlayhead(0)
    buffers.current.clear()
    void saveProject(next).then(() => pruneAudio(next)).catch(() => undefined)
  }, [])

  // ---- Fret ----
  const handleAction = useCallback((action: StudioAction) => {
    switch (action.type) {
      case 'play': void play(); break
      case 'stop': void stop(); break
      case 'record': if (action.on) void record(); else void stopRecordingRef.current(); break
      case 'genre': update((current) => setGenre(current, action.id)); break
      case 'preset': applyToSelected(action.id); break
      case 'addTrack': addTrack(action.role); break
      case 'export': void exportAudio(action.what); break
      case 'metronome': update((current) => ({ ...current, metronome: action.on })); break
      case 'countIn': update((current) => ({ ...current, countInBars: action.bars })); break
      case 'loop': update((current) => ({ ...current, loop: { ...current.loop, on: action.on, end: current.loop.end > current.loop.start ? current.loop.end : current.loop.start + secondsPerBar(current.bpm) * 4 } })); break
      case 'tempo': update((current) => ({ ...current, bpm: Math.max(50, Math.min(240, action.bpm ?? current.bpm + (action.delta ?? 0))) })); break
      case 'import': fileInput.current?.click(); break
    }
  }, [addTrack, applyToSelected, exportAudio, play, record, stop, update])

  useEffect(() => registerStudioHandler(handleAction), [handleAction])
  useEffect(() => {
    publishStudioStatus({ ready: audioReady, playing, recording, genre: project.genre, bpm: project.bpm, tracks: project.tracks.length, armedTrack: armedTrack(project)?.name })
  }, [audioReady, playing, recording, project])

  // Keyboard: Space plays/stops, R records.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      else if (event.key === 'r' || event.key === 'R') { event.preventDefault(); toggleRecord() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, toggleRecord])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(undefined), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const length = useMemo(() => Math.max(60, projectDuration(project) + 20, project.loop.on ? project.loop.end + 8 : 0), [project])
  const clipInfo = useMemo(() => {
    if (!selectedClip) return undefined
    const track = project.tracks.find((candidate) => candidate.id === selectedClip.trackId)
    const clip = track?.clips.find((candidate) => candidate.id === selectedClip.clipId)
    return track && clip ? { track, clip } : undefined
  }, [project, selectedClip])
  const armed = armedTrack(project)
  const bar = secondsPerBar(project.bpm, project.beatsPerBar)
  void bufferVersion

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-secondary">Studio · vocal booth</p>
          <input value={project.name} onChange={(event) => setProject((current) => ({ ...current, name: event.target.value }))} aria-label="Session name" className="mt-1 w-full max-w-xl bg-transparent font-display text-3xl font-black uppercase tracking-wide text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 sm:text-4xl" />
          <p className="mt-1 text-sm text-foreground/50">Import your instrumental, arm a track, put on headphones, and record. Takes stack, effects stay editable, everything saves in this browser.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">
            Genre
            <select value={project.genre} onChange={(event) => update((current) => setGenre(current, event.target.value))} aria-label="Session genre" className="ml-2 rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-sm font-semibold normal-case tracking-normal text-foreground">
              {GENRES.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-background hover:bg-secondary"><UploadIcon width={16} height={16} />Import instrumental</button>
          <input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aif,.aiff" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void importFiles(files) }} />
          <button type="button" onClick={newSession} className="rounded-full border border-foreground/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground/60 hover:border-foreground/40 hover:text-foreground">New session</button>
        </div>
      </section>

      {/* Transport */}
      <section className="z-30 flex sm:sticky sm:top-[68px] flex-wrap items-center gap-3 rounded-3xl border border-foreground/10 bg-surface/95 p-3 backdrop-blur sm:p-4">
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Stop' : 'Play'} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-background hover:bg-secondary">{playing ? <PauseIcon /> : <PlayIcon />}</button>
        <button type="button" onClick={toggleRecord} aria-label={recording ? 'Stop recording' : 'Record'} aria-pressed={recording} disabled={!armed && !recording} title={armed ? `Record onto ${armed.name} (R)` : 'Arm a vocal track first'} className={`grid h-12 w-12 place-items-center rounded-full border-2 transition disabled:opacity-40 ${recording ? 'animate-pulse border-red-400 bg-red-500 text-white' : 'border-red-500 text-red-400 hover:bg-red-500/15'}`}>
          <span className={`block ${recording ? 'h-4 w-4 rounded-sm bg-white' : 'h-5 w-5 rounded-full bg-red-500'}`} />
        </button>
        <button type="button" onClick={() => seek(0)} aria-label="Back to start" className="rounded-full border border-foreground/15 px-3 py-2 text-xs font-bold text-foreground/60 hover:text-foreground">⏮</button>
        <span ref={clockRef} className="min-w-44 font-mono text-sm text-foreground/80" aria-live="off">0:00.0 · bar 1.1</span>
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/55">BPM
          <input type="number" min={50} max={240} value={project.bpm} onChange={(event) => { const bpm = Number(event.target.value); if (bpm >= 50 && bpm <= 240) update((current) => ({ ...current, bpm })) }} aria-label="Tempo" className="w-16 rounded-lg border border-foreground/15 bg-background px-2 py-1 font-mono text-sm text-foreground" />
        </label>
        <Toggle on={project.metronome} label="Click" onClick={() => update((current) => ({ ...current, metronome: !current.metronome }))} title="Metronome" />
        <label className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">Count-in
          <select value={project.countInBars} onChange={(event) => update((current) => ({ ...current, countInBars: Number(event.target.value) }))} aria-label="Count-in" className="ml-2 rounded-full border border-foreground/15 bg-background px-2 py-1 text-xs normal-case text-foreground">
            <option value={0}>Off</option><option value={1}>1 bar</option><option value={2}>2 bars</option>
          </select>
        </label>
        <Toggle on={project.loop.on} label="Loop" onClick={() => handleAction({ type: 'loop', on: !project.loop.on })} title="Loop a region; recording in a loop makes one take per pass" />
        {project.loop.on && (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-foreground/55">Bars
            <input type="number" min={1} value={Math.round(project.loop.start / bar) + 1} onChange={(event) => { const start = Math.max(0, (Number(event.target.value) - 1) * bar); update((current) => ({ ...current, loop: { ...current.loop, start, end: Math.max(start + bar, current.loop.end) } })) }} aria-label="Loop start bar" className="w-12 rounded-lg border border-foreground/15 bg-background px-1.5 py-1 font-mono text-xs text-foreground" />
            to
            <input type="number" min={2} value={Math.round(project.loop.end / bar) + 1} onChange={(event) => { const end = Math.max(bar, (Number(event.target.value) - 1) * bar); update((current) => ({ ...current, loop: { ...current.loop, end: Math.max(current.loop.start + bar, end) } })) }} aria-label="Loop end bar" className="w-12 rounded-lg border border-foreground/15 bg-background px-1.5 py-1 font-mono text-xs text-foreground" />
          </span>
        )}
        <div className="ml-auto flex items-center gap-4">
          <LevelMeter db={levels.mic} label="Mic" />
          <LevelMeter db={levels.master} label="Out" />
          <button type="button" onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings} className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-bold text-foreground/60 hover:text-foreground">Settings</button>
        </div>
        {showSettings && (
          <div className="grid w-full gap-4 border-t border-foreground/10 pt-3 sm:grid-cols-3">
            <Slider label="Latency fix" value={project.latencyMs} min={0} max={400} step={1} display={`${project.latencyMs} ms`} onChange={(latencyMs) => update((current) => ({ ...current, latencyMs }))} hint="Shifts new takes earlier to make up for audio delay. Raise it if takes land late." />
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55">Microphone
              <select value={deviceId ?? ''} onFocus={() => { void navigator.mediaDevices?.enumerateDevices?.().then((list) => setDevices(list.filter((device) => device.kind === 'audioinput'))).catch(() => undefined) }} onChange={async (event) => { const id = event.target.value || undefined; setDeviceId(id); const engine = engineRef.current; if (engine) { engine.closeMic(); try { await engine.openMic(id) } catch (reason) { setError(micError(reason)) } } }} className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground">
                <option value="">Default input</option>
                {devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Input ${index + 1}`}</option>)}
              </select>
            </label>
            <Slider label="Zoom" value={zoom} min={6} max={120} step={1} display={`${zoom} px/s`} onChange={setZoom} />
            <p className="text-xs leading-5 text-foreground/45 sm:col-span-3">Wear wired headphones: speakers bleed into the mic and Bluetooth adds a lot of delay. Monitoring (🎧) lets you hear your voice with effects; turn it off if the delay bothers you. Space plays and stops, R records.</p>
          </div>
        )}
      </section>

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-200"><span>{error}</span><button type="button" onClick={() => setError(undefined)} aria-label="Dismiss" className="text-red-200/70 hover:text-red-100">✕</button></div>}
      {(busy || notice) && <div role="status" className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-sm text-primary">{busy ?? notice}</div>}
      {!audioReady && project.tracks.every((track) => !track.clips.length) && (
        <section className="grid gap-4 rounded-3xl border border-dashed border-foreground/15 bg-foreground/[0.015] p-6 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
          <img src="/riffmancer-emblem.webp" width={120} height={120} alt="" className="mx-auto w-28 rounded-2xl" />
          <ol className="space-y-1.5 text-sm text-foreground/70">
            <li><strong className="text-foreground">1. Import</strong> your instrumental (a Suno MP3 or WAV, Stem Lab stems, or a Beat Maker take).</li>
            <li><strong className="text-foreground">2. Pick your genre</strong> above. Every vocal track gets that genre's chain.</li>
            <li><strong className="text-foreground">3. Record:</strong> headphones on, hit ● (or R). You get a count-in, then sing. Record again at the same spot to stack takes.</li>
            <li><strong className="text-foreground">4. Export</strong> the mix or stems as WAV when it slaps.</li>
          </ol>
        </section>
      )}

      <Timeline
        project={project}
        buffers={buffers.current}
        pixelsPerSecond={zoom}
        length={length}
        selectedTrackId={selectedTrack?.id}
        selectedClipId={selectedClip?.clipId}
        playheadRef={playheadLine}
        onSeek={seek}
        onSelectTrack={(id) => { setSelectedTrackId(id); setSelectedClip(undefined) }}
        onSelectClip={(trackId, clipId) => { setSelectedTrackId(trackId); setSelectedClip({ trackId, clipId }) }}
        onMoveClip={(trackId, clipId, start) => update((current) => moveClip(current, trackId, clipId, start))}
        onTrack={onTrack}
        onRemoveTrack={onRemoveTrack}
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={addRole} onChange={(event) => setAddRole(event.target.value as VocalRole)} aria-label="New track type" className="rounded-full border border-foreground/15 bg-background px-3 py-2 text-xs font-bold text-foreground">
          {(Object.keys(ROLE_NAMES) as VocalRole[]).map((role) => <option key={role} value={role}>{ROLE_NAMES[role]}</option>)}
        </select>
        <button type="button" onClick={() => addTrack(addRole)} disabled={project.tracks.length >= MAX_TRACKS} className="rounded-full border border-primary/50 px-4 py-2 text-xs font-black uppercase tracking-wider text-primary hover:bg-primary hover:text-background disabled:opacity-40">+ Add vocal track</button>
        <span className="text-xs text-foreground/40">Drag clips to move them (snaps to beats; hold Shift for free). Click a clip to choose takes.</span>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => void exportAudio('mix')} disabled={Boolean(busy)} className="rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-background hover:bg-secondary disabled:opacity-40">Export mix (WAV)</button>
          <button type="button" onClick={() => void exportAudio('stems')} disabled={Boolean(busy)} className="rounded-full border border-secondary px-4 py-2 text-xs font-black uppercase tracking-wider text-secondary hover:bg-secondary hover:text-background disabled:opacity-40">Export stems (zip)</button>
        </span>
      </div>

      {clipInfo && (
        <Panel title={`Takes · ${clipInfo.track.name} at bar ${barBeat(clipInfo.clip.start, project.bpm, project.beatsPerBar)}`} actions={<button type="button" onClick={() => { update((current) => removeClip(current, clipInfo.track.id, clipInfo.clip.id)); setSelectedClip(undefined) }} className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/15">Delete clip</button>}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clipInfo.clip.takes.map((take) => {
              const active = activeTake(clipInfo.clip).id === take.id
              return (
                <li key={take.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${active ? 'border-primary bg-primary/10' : 'border-foreground/10'}`}>
                  <button type="button" aria-pressed={active} onClick={() => update((current) => setActiveTake(current, clipInfo.track.id, clipInfo.clip.id, take.id))} className="flex-1 text-left">
                    <span className="block text-sm font-bold text-foreground">{active ? '★ ' : ''}{take.name}</span>
                    <span className="block font-mono text-[11px] text-foreground/45">{clock(take.duration)}</span>
                  </button>
                  <button type="button" onClick={() => { seek(clipInfo.clip.start); void play() }} className="rounded-full border border-foreground/15 px-2.5 py-1 text-[11px] font-bold text-foreground/60 hover:text-foreground" aria-label={`Play from ${take.name}`} disabled={!active}>▶</button>
                  <button type="button" onClick={() => update((current) => removeTake(current, clipInfo.track.id, clipInfo.clip.id, take.id))} className="rounded-full px-2 py-1 text-xs text-foreground/40 hover:bg-red-500/20 hover:text-red-200" aria-label={`Delete ${take.name}`}>✕</button>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-foreground/45">The ★ take plays. Record again starting at this clip's position to add more takes, or turn on Loop to record several in a row.</p>
        </Panel>
      )}

      {selectedTrack && (
        <FxPanel
          track={selectedTrack}
          onPreset={(id) => update((current) => applyPreset(current, selectedTrack.id, id))}
          onChange={(changes) => update((current) => updateChain(current, selectedTrack.id, changes))}
        />
      )}
      <MasterPanel
        project={project}
        onPreset={(id) => update((current) => applyMasterPreset(current, id))}
        onChange={(changes) => update((current) => ({ ...current, masterPresetId: 'custom', master: { ...current.master, ...changes } }))}
        onVolume={(masterVolume) => update((current) => ({ ...current, masterVolume }))}
      />
      <p className="pb-4 text-center text-xs text-foreground/35">Coming next: pitch correction, take comping, clip trimming and fades, automation, and key/BPM detection.</p>
    </div>
  )
}
