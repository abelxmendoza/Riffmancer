import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { audioUrl } from '../services/api'
import type { Project } from '../types'
import { formatBytes, formatSampleRate, formatTime } from '../lib/format'
import { PauseIcon, PlayIcon } from './Icons'

export function WaveformPlayer({ project }: { project: Project }) {
  const container = useRef<HTMLDivElement>(null)
  const wave = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadError, setLoadError] = useState<string>()

  useEffect(() => {
    if (!container.current) return
    setReady(false)
    setPlaying(false)
    setCurrentTime(0)
    setLoadError(undefined)
    const instance = WaveSurfer.create({
      container: container.current,
      url: audioUrl(project.id),
      height: 152,
      waveColor: '#22C55E',
      progressColor: '#A3E635',
      cursorColor: '#E5F7E7',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
    })
    wave.current = instance
    instance.on('ready', () => setReady(true))
    instance.on('timeupdate', (time) => setCurrentTime(time))
    instance.on('play', () => setPlaying(true))
    instance.on('pause', () => setPlaying(false))
    instance.on('finish', () => setPlaying(false))
    instance.on('error', () => setLoadError('This browser could not decode the audio. Try WAV, MP3, or M4A.'))
    return () => { instance.destroy(); wave.current = null }
  }, [project.id])

  const metadata = [
    ['Duration', formatTime(project.audio.duration_seconds)],
    ['Format', project.audio.format_name.split(',')[0].toUpperCase()],
    ['Sample rate', formatSampleRate(project.audio.sample_rate)],
    ['Channels', project.audio.channels === 1 ? 'Mono' : project.audio.channels === 2 ? 'Stereo' : String(project.audio.channels)],
    ['Size', formatBytes(project.audio.size_bytes)],
  ]

  return (
    <section className="overflow-hidden rounded-3xl border border-foreground/10 bg-surface">
      <div className="border-b border-foreground/10 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Original reference</p>
            <h1 className="truncate text-3xl font-black tracking-tight text-foreground sm:text-4xl">{project.title}</h1>
            <p className="mt-2 truncate text-sm text-foreground/50">{project.original_filename}</p>
          </div>
          <span className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">Immutable source</span>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        <div className="rounded-2xl border border-foreground/5 bg-background p-4 sm:p-6">
          <div ref={container} aria-label={`Waveform for ${project.title}`} />
          {loadError && <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{loadError}</p>}
          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              disabled={!ready}
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => wave.current?.playPause()}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-background transition hover:scale-105 hover:bg-secondary disabled:opacity-30"
            >
              {playing ? <PauseIcon /> : <PlayIcon className="ml-0.5" />}
            </button>
            <div className="flex flex-1 items-center justify-between font-mono text-sm tabular-nums">
              <span className="text-foreground">{formatTime(currentTime)}</span>
              <span className="text-foreground/50">{formatTime(project.audio.duration_seconds)}</span>
            </div>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-foreground/5 bg-foreground/5 sm:grid-cols-5">
          {metadata.map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-4">
              <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/35">{label}</dt>
              <dd className="mt-1.5 text-sm font-semibold text-foreground/80">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
