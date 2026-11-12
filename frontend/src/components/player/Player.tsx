import { useCallback, useEffect, useRef, useState } from 'react'
import { registerPlayerHandler, type PlayerAction } from '../../player/bus'
import { renderDemoTrack } from '../../player/demo'
import { PlayerEngine } from '../../player/engine'
import { isAudioFile, nextIndex, previousIndex, shuffledOrder, titleFromFileName, type RepeatMode, type Track } from '../../player/playlist'
import { THEMES } from '../../player/themes'
import { setTheme, useThemeState } from '../../theme/store'
import { VISUAL_MODES } from '../../player/visualizers'
import { formatTime } from '../../lib/format'
import { MusicIcon, PauseIcon, PlayIcon, UploadIcon } from '../Icons'
import { Visualizer } from './Visualizer'

const SETTINGS_KEY = 'riffmancer.player.settings'

interface Settings { mode: string; themeId: string; beatFx: boolean; autoCycle: boolean; volume: number }
const DEFAULT_SETTINGS: Settings = { mode: 'skull', themeId: 'toxic', beatFx: true, autoCycle: false, volume: 0.9 }

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

let trackCounter = 0
const makeId = () => `t${Date.now().toString(36)}${(trackCounter += 1)}`

const iconButton = 'grid h-11 w-11 place-items-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground disabled:opacity-30'
const chip = (active: boolean) => `rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${active ? 'border-primary bg-primary text-background' : 'border-foreground/15 text-foreground/60 hover:border-foreground/40 hover:text-foreground'}`

export function Player() {
  const engineRef = useRef<PlayerEngine | null>(null)
  if (!engineRef.current) engineRef.current = new PlayerEngine()
  const engine = engineRef.current
  const audio = engine.audio

  const [tracks, setTracks] = useState<Track[]>([])
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [repeat, setRepeat] = useState<RepeatMode>('all')
  const [shuffle, setShuffle] = useState(false)
  const [order, setOrder] = useState<number[]>()
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [graphReady, setGraphReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [tripSeed, setTripSeed] = useState(0)
  const [presetName, setPresetName] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const state = useRef({ tracks, current, repeat, order, settings })
  state.current = { tracks, current, repeat, order, settings }

  const update = (patch: Partial<Settings>) => setSettings((value) => ({ ...value, ...patch }))
  // The visualizer colours are the app's colour theme: one choice, everywhere.
  const appThemeId = useThemeState().id
  useEffect(() => { setSettings((value) => (value.themeId === appThemeId ? value : { ...value, themeId: appThemeId })) }, [appThemeId])
  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* private mode */ }
    audio.volume = settings.volume
  }, [settings, audio])

  // Free the audio when leaving the page.
  useEffect(() => () => {
    engine.dispose()
    state.current.tracks.forEach((track) => URL.revokeObjectURL(track.url))
  }, [engine])

  /** Loads a track and plays it. Pass `fresh` for a track that was just added and isn't in state yet. */
  const load = useCallback(async (index: number, autoplay = true, fresh?: Track) => {
    const track = fresh ?? state.current.tracks[index]
    if (!track) return
    setCurrent(index)
    setError(undefined)
    if (audio.src !== track.url) audio.src = track.url
    if (!autoplay) return
    engine.ensureGraph()
    setGraphReady(true)
    try {
      await audio.play()
    } catch {
      setError(`Couldn't play "${track.title}". The browser may not support that file type.`)
    }
  }, [audio, engine])

  const togglePlay = useCallback(async () => {
    const { tracks: list, current: index } = state.current
    if (!list.length) return
    if (index < 0) { await load(0); return }
    engine.ensureGraph()
    setGraphReady(true)
    if (audio.paused) {
      try { await audio.play() } catch { setError('Playback was blocked. Click play again.') }
    } else {
      audio.pause()
    }
  }, [audio, engine, load])

  const skip = useCallback((direction: 1 | -1) => {
    const { tracks: list, current: index, repeat: mode, order: sequence } = state.current
    if (!list.length) return
    if (direction === -1 && audio.currentTime > 3) { audio.currentTime = 0; return }
    const target = direction === 1 ? nextIndex(index, list.length, mode === 'one' ? 'all' : mode, sequence) ?? 0 : previousIndex(index, list.length, sequence)
    if (target !== undefined) void load(target)
  }, [audio, load])

  // Audio element events.
  useEffect(() => {
    const onTime = () => setTime(audio.currentTime)
    const onMeta = () => {
      setDuration(audio.duration || 0)
      const index = state.current.current
      setTracks((list) => list.map((track, position) => (position === index ? { ...track, duration: audio.duration } : track)))
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      const { tracks: list, current: index, repeat: mode, order: sequence } = state.current
      const target = nextIndex(index, list.length, mode, sequence)
      if (target === undefined) { setPlaying(false); return }
      if (target === index) { audio.currentTime = 0; void audio.play() } else void load(target)
    }
    const onError = () => { if (audio.src) setError('That file could not be decoded. Try MP3, WAV, OGG, FLAC or M4A.') }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [audio, load])

  const addFiles = useCallback((files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(isAudioFile)
    if (!audioFiles.length) { setError('Those don\'t look like audio files. Drop MP3, WAV, OGG, FLAC or M4A.'); return }
    const added = audioFiles.map((file) => ({ id: makeId(), title: titleFromFileName(file.name), url: URL.createObjectURL(file) }))
    const startAt = state.current.tracks.length
    const wasEmpty = state.current.current < 0
    setTracks((list) => [...list, ...added])
    setOrder(undefined)
    setShuffle(false)
    if (wasEmpty) void load(startAt, true, added[0])
  }, [load])

  const addDemo = useCallback(async () => {
    setDemoBusy(true)
    setError(undefined)
    // Make the audio graph now, while we're still inside the click.
    engine.ensureGraph()
    setGraphReady(true)
    try {
      const blob = await renderDemoTrack()
      const track: Track = { id: makeId(), title: 'Riffmancer demo: Bone Dust (DnB)', url: URL.createObjectURL(blob), demo: true }
      const index = state.current.tracks.length
      setTracks((list) => [...list, track])
      void load(index, true, track)
    } catch {
      setError('Could not build the demo track in this browser.')
    } finally {
      setDemoBusy(false)
    }
  }, [engine, load])

  const remove = (index: number) => {
    const track = tracks[index]
    if (!track) return
    if (index === current) { audio.pause(); audio.removeAttribute('src'); setCurrent(-1); setTime(0); setDuration(0) } else if (index < current) setCurrent(current - 1)
    URL.revokeObjectURL(track.url)
    setTracks((list) => list.filter((_, position) => position !== index))
    setOrder(undefined)
    setShuffle(false)
  }

  const toggleShuffle = () => {
    if (shuffle) { setShuffle(false); setOrder(undefined) } else { setShuffle(true); setOrder(shuffledOrder(tracks.length, Math.max(0, current))) }
  }

  const cycleVisual = useCallback((id?: string) => {
    const { mode } = state.current.settings
    if (id) { update({ mode: id }); return }
    if (mode === 'milkdrop') { setTripSeed((seed) => seed + 1); return }
    const position = VISUAL_MODES.findIndex((item) => item.id === mode)
    update({ mode: VISUAL_MODES[(position + 1) % VISUAL_MODES.length].id })
  }, [])

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stage.requestFullscreen?.().catch(() => setFullscreen((value) => !value))
  }, [])
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Auto-cycle: a new look every 20 seconds while music plays.
  useEffect(() => {
    if (!settings.autoCycle || !playing) return
    const timer = window.setInterval(() => cycleVisual(), 20000)
    return () => window.clearInterval(timer)
  }, [settings.autoCycle, playing, cycleVisual])

  // Fret can drive the player.
  useEffect(() => registerPlayerHandler((action: PlayerAction) => {
    switch (action.type) {
      case 'toggle': void togglePlay(); break
      case 'play': if (audio.paused) void togglePlay(); break
      case 'pause': audio.pause(); break
      case 'next': skip(1); break
      case 'previous': skip(-1); break
      case 'visual': cycleVisual(action.id); break
      case 'theme': setTheme(action.id); break
      case 'fullscreen': toggleFullscreen(); break
      case 'demo': void addDemo(); break
    }
  }), [audio, togglePlay, skip, cycleVisual, toggleFullscreen, addDemo])

  // Keyboard shortcuts.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && ((target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      if (event.code === 'Space') { event.preventDefault(); void togglePlay() }
      else if (key === 'arrowright') { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5) }
      else if (key === 'arrowleft') { audio.currentTime = Math.max(0, audio.currentTime - 5) }
      else if (key === 'n') skip(1)
      else if (key === 'p') skip(-1)
      else if (key === 'v') cycleVisual()
      else if (key === 'f') toggleFullscreen()
      else if (key === 't') {
        const position = THEMES.findIndex((theme) => theme.id === state.current.settings.themeId)
        setTheme(THEMES[(position + 1) % THEMES.length].id)
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [audio, togglePlay, skip, cycleVisual, toggleFullscreen])

  const track = tracks[current]
  const mode = VISUAL_MODES.find((item) => item.id === settings.mode) ?? VISUAL_MODES[0]
  const hasTracks = tracks.length > 0

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-5" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={onDrop}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-secondary">Player</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase text-foreground sm:text-4xl">Watch your songs <span className="text-primary">come alive</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/55">Drop in your tracks and the visuals react to every kick, riff and hi-hat. Your files stay on your computer; nothing is uploaded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-background hover:bg-secondary">
            <UploadIcon width={16} height={16} /> Add songs
          </button>
          <button type="button" onClick={() => void addDemo()} disabled={demoBusy} className="rounded-full border border-foreground/15 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-foreground/80 hover:border-secondary hover:text-foreground disabled:opacity-50">
            {demoBusy ? 'Summoning…' : 'Play a demo'}
          </button>
          <input ref={fileInput} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} />
        </div>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Visualizer" className="min-w-0 space-y-3">
          <div ref={stageRef} className={`group relative overflow-hidden border border-foreground/10 bg-black ${fullscreen ? 'fixed inset-0 z-[80] rounded-none' : 'aspect-[16/10] rounded-[1.75rem] sm:aspect-video'}`}>
            <Visualizer engine={engine} mode={settings.mode} themeId={settings.themeId} beatFx={settings.beatFx} graphReady={graphReady} tripSeed={tripSeed} onPresetName={setPresetName} />

            {!hasTracks && (
              <div className={`absolute inset-0 grid place-items-center p-6 text-center transition ${dragging ? 'bg-primary/20' : 'bg-black/35'}`}>
                <div>
                  <p className="font-display text-lg font-black uppercase text-foreground sm:text-3xl">{dragging ? 'Drop it like it’s hot' : 'Drop your songs here'}</p>
                  <p className="mt-2 text-xs text-foreground/60 sm:text-sm">MP3, WAV, FLAC, OGG or M4A. Or hit “Play a demo”.</p>
                </div>
              </div>
            )}
            {hasTracks && dragging && <div className="absolute inset-0 grid place-items-center bg-primary/20 text-2xl font-black uppercase text-foreground">Add to playlist</div>}

            {/* Now playing + quick controls, over the picture. */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/50">{mode.name}{settings.mode === 'milkdrop' && presetName ? ` · ${presetName}` : ''}</p>
                {track && <p className="truncate font-display text-lg font-black uppercase text-foreground drop-shadow">{track.title}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => cycleVisual()} className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-foreground/80 backdrop-blur hover:text-primary" title="Next visual (V)">{settings.mode === 'milkdrop' ? 'Next trip' : 'Next visual'}</button>
                <button type="button" onClick={toggleFullscreen} className="rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-foreground/80 backdrop-blur hover:text-primary" title="Full screen (F)">{fullscreen ? 'Exit' : 'Full screen'}</button>
              </div>
            </div>
            {fullscreen && (
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent p-5 opacity-0 transition group-hover:opacity-100">
                <button type="button" onClick={() => void togglePlay()} className="grid h-12 w-12 place-items-center rounded-full bg-primary text-background" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
                <p className="truncate font-bold text-foreground">{track?.title}</p>
              </div>
            )}
          </div>

          {/* Transport */}
          <div className="rounded-[1.5rem] border border-foreground/10 bg-surface p-4">
            <div className="flex items-center gap-3 font-mono text-xs text-foreground/55">
              <span className="w-10 text-right">{formatTime(time)}</span>
              <input type="range" aria-label="Seek" className="h-1.5 flex-1 accent-primary" min={0} max={duration || 0} step={0.1} value={Math.min(time, duration || 0)} disabled={!track} onChange={(event) => { audio.currentTime = Number(event.target.value); setTime(audio.currentTime) }} />
              <span className="w-10">{formatTime(duration)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button type="button" className={`${chip(shuffle)} mr-1`} onClick={toggleShuffle} disabled={tracks.length < 2} aria-pressed={shuffle}>Shuffle</button>
                <button type="button" className={iconButton} onClick={() => skip(-1)} disabled={!hasTracks} aria-label="Previous track" title="Previous (P)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
                </button>
                <button type="button" onClick={() => void togglePlay()} disabled={!hasTracks} aria-label={playing ? 'Pause' : 'Play'} className="grid h-14 w-14 place-items-center rounded-full bg-primary text-background shadow-[0_0_30px_rgba(163,230,53,0.35)] transition hover:bg-secondary disabled:opacity-40">
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button type="button" className={iconButton} onClick={() => skip(1)} disabled={!hasTracks} aria-label="Next track" title="Next (N)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
                </button>
                <button type="button" className={`${chip(repeat !== 'off')} ml-1`} onClick={() => setRepeat((value) => (value === 'all' ? 'one' : value === 'one' ? 'off' : 'all'))} aria-label={`Repeat: ${repeat}`}>
                  {repeat === 'one' ? 'Repeat 1' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
                </button>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/55">
                Volume
                <input type="range" aria-label="Volume" className="w-28 accent-primary" min={0} max={1} step={0.01} value={settings.volume} onChange={(event) => update({ volume: Number(event.target.value) })} />
              </label>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section aria-labelledby="visuals-heading" className="rounded-[1.5rem] border border-foreground/10 bg-surface p-4">
            <h2 id="visuals-heading" className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/50">Visuals</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {VISUAL_MODES.map((item) => (
                <button key={item.id} type="button" onClick={() => update({ mode: item.id })} aria-pressed={settings.mode === item.id} className={`rounded-xl border p-2.5 text-left transition ${settings.mode === item.id ? 'border-primary bg-primary/10' : 'border-foreground/10 hover:border-foreground/30'}`}>
                  <span className={`block text-xs font-black uppercase tracking-wider ${settings.mode === item.id ? 'text-primary' : 'text-foreground'}`}>{item.name}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-foreground/45">{item.blurb}</span>
                </button>
              ))}
            </div>
            <h3 className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-foreground/50">Colours</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <button key={theme.id} type="button" onClick={() => setTheme(theme.id)} aria-pressed={settings.themeId === theme.id} title={`${theme.name} (${theme.vibe})`} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold transition ${settings.themeId === theme.id ? 'border-foreground/60 text-foreground' : 'border-foreground/10 text-foreground/55 hover:border-foreground/30'}`}>
                  <span className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg, ${theme.colors[1]}, ${theme.colors[2]}, ${theme.colors[3]})` }} />
                  {theme.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-foreground/35">{settings.mode === 'milkdrop' ? 'MilkDrop presets bring their own colours.' : `${THEMES.find((theme) => theme.id === settings.themeId)?.vibe} vibes.`}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={chip(settings.beatFx)} aria-pressed={settings.beatFx} onClick={() => update({ beatFx: !settings.beatFx })}>Shake on hits</button>
              <button type="button" className={chip(settings.autoCycle)} aria-pressed={settings.autoCycle} onClick={() => update({ autoCycle: !settings.autoCycle })}>Auto-switch</button>
            </div>
          </section>

          <section aria-labelledby="playlist-heading" className="rounded-[1.5rem] border border-foreground/10 bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 id="playlist-heading" className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/50">Playlist</h2>
              <span className="text-[11px] text-foreground/35">{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</span>
            </div>
            {!hasTracks && (
              <button type="button" onClick={() => fileInput.current?.click()} className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50 hover:border-primary/50 hover:text-foreground">
                <MusicIcon /> Add songs or drag them anywhere on this page
              </button>
            )}
            <ol className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
              {tracks.map((item, index) => (
                <li key={item.id} className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 ${index === current ? 'bg-primary/10' : 'hover:bg-foreground/5'}`}>
                  <button type="button" onClick={() => void load(index)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={index === current ? 'true' : undefined}>
                    <span className={`w-5 text-center font-mono text-[11px] ${index === current ? 'text-primary' : 'text-foreground/35'}`}>{index === current && playing ? '▶' : index + 1}</span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${index === current ? 'font-bold text-foreground' : 'text-foreground/75'}`}>{item.title}</span>
                    <span className="font-mono text-[11px] text-foreground/35">{item.duration ? formatTime(item.duration) : ''}</span>
                  </button>
                  <button type="button" onClick={() => remove(index)} aria-label={`Remove ${item.title}`} className="grid h-7 w-7 place-items-center rounded-full text-foreground/30 opacity-0 hover:bg-foreground/10 hover:text-foreground focus:opacity-100 group-hover:opacity-100">×</button>
                </li>
              ))}
            </ol>
          </section>

          <p className="px-1 text-[11px] leading-5 text-foreground/35">
            Keys: <kbd className="font-mono text-foreground/60">Space</kbd> play, <kbd className="font-mono text-foreground/60">N</kbd>/<kbd className="font-mono text-foreground/60">P</kbd> next/previous, <kbd className="font-mono text-foreground/60">← →</kbd> seek, <kbd className="font-mono text-foreground/60">V</kbd> visual, <kbd className="font-mono text-foreground/60">T</kbd> colours, <kbd className="font-mono text-foreground/60">F</kbd> full screen.
          </p>
        </aside>
      </div>
    </div>
  )
}
