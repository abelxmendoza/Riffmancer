import { useEffect, useRef, useState } from 'react'
import { SharedStemTransport, STEM_NAMES, type StemControls } from '../audio/SharedStemTransport'
import { formatTime } from '../lib/format'
import { stemAudioUrl, stemDownloadUrl, stemsZipUrl } from '../services/api'
import type { SeparationJob, StemName } from '../types'
import { DownloadIcon, PauseIcon, PlayIcon } from './Icons'

const initialControls = (): StemControls => ({
  vocals: { muted: false, soloed: false, volume: 1 },
  drums: { muted: false, soloed: false, volume: 1 },
  bass: { muted: false, soloed: false, volume: 1 },
  other: { muted: false, soloed: false, volume: 1 },
})

export function StemMixer({ projectId, job }: { projectId: string; job: SeparationJob }) {
  const transport = useRef<SharedStemTransport | null>(null)
  const [controls, setControls] = useState<StemControls>(initialControls)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    let cancelled = false
    const instance = new SharedStemTransport(initialControls())
    transport.current = instance
    const urls = Object.fromEntries(STEM_NAMES.map((name) => [name, stemAudioUrl(projectId, name)])) as Record<StemName, string>
    instance.load(urls)
      .then(() => {
        if (cancelled) return
        setDuration(instance.duration)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoadError(reason instanceof Error ? reason.message : 'Stem audio could not be loaded.')
        setLoading(false)
      })
    return () => {
      cancelled = true
      transport.current = null
      void instance.destroy()
    }
  }, [projectId, job.id])

  useEffect(() => {
    transport.current?.applyControls(controls)
  }, [controls])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const instance = transport.current
      if (!instance) return
      const next = instance.position()
      setPosition(next)
      if (next >= instance.duration) {
        instance.pause()
        setPlaying(false)
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing])

  const togglePlayback = async () => {
    const instance = transport.current
    if (!instance) return
    try {
      if (instance.playing) {
        instance.pause()
        setPosition(instance.position())
        setPlaying(false)
      } else {
        await instance.play()
        setPlaying(true)
      }
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Playback could not start.')
    }
  }

  const update = (name: StemName, patch: Partial<StemControls[StemName]>) => {
    setControls((current) => ({ ...current, [name]: { ...current[name], ...patch } }))
  }

  const seek = async (seconds: number) => {
    try {
      await transport.current?.seek(seconds)
      setPosition(seconds)
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Could not seek the stem mix.')
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-foreground/10 bg-surface">
      <div className="border-b border-foreground/10 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Synchronized stem mixer</p>
            <h2 className="mt-2 text-2xl font-black text-foreground">Four parts. One transport.</h2>
            <p className="mt-2 text-sm text-foreground/50">Other combines instruments such as guitars, keyboards, and everything outside vocals, drums, and bass.</p>
          </div>
          <a href={stemsZipUrl(projectId)} download className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-background transition hover:bg-secondary">
            <DownloadIcon className="h-5 w-5" /> Download all stems
          </a>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        {loading ? <p className="rounded-2xl bg-background px-5 py-8 text-center text-sm text-foreground/70">Loading and decoding four WAV files…</p> : null}
        {loadError ? <p role="alert" className="mb-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-200">{loadError}</p> : null}
        {!loading && !loadError ? (
          <>
            <div className="mb-6 rounded-2xl bg-background p-5">
              <div className="flex items-center gap-4">
                <button type="button" aria-label={playing ? 'Pause stem mix' : 'Play stem mix'} onClick={() => void togglePlayback()} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-background transition hover:scale-105 hover:bg-secondary">
                  {playing ? <PauseIcon /> : <PlayIcon className="ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <input aria-label="Stem mix position" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(position, duration)} onChange={(event) => void seek(Number(event.target.value))} className="w-full accent-primary" />
                  <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-foreground/50"><span>{formatTime(position)}</span><span>{formatTime(duration)}</span></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {STEM_NAMES.map((name) => {
                const stem = job.stems[name]
                const control = controls[name]
                return (
                  <div key={name} className="grid gap-4 rounded-2xl border border-foreground/5 bg-background/70 p-4 sm:grid-cols-[130px_auto_minmax(150px,1fr)_40px] sm:items-center">
                    <div><p className="font-bold text-foreground">{stem?.label ?? name}</p><p className="text-xs uppercase tracking-wider text-foreground/35">{stem?.audio.codec_name ?? 'WAV'}</p></div>
                    <div className="flex gap-2">
                      <button type="button" aria-label={`Mute ${stem?.label ?? name}`} aria-pressed={control.muted} onClick={() => update(name, { muted: !control.muted })} className={`rounded-lg px-3 py-2 text-xs font-black ${control.muted ? 'bg-secondary text-background' : 'bg-foreground/5 text-foreground/70 hover:text-foreground'}`}>M</button>
                      <button type="button" aria-label={`Solo ${stem?.label ?? name}`} aria-pressed={control.soloed} onClick={() => update(name, { soloed: !control.soloed })} className={`rounded-lg px-3 py-2 text-xs font-black ${control.soloed ? 'bg-primary text-background' : 'bg-foreground/5 text-foreground/70 hover:text-foreground'}`}>S</button>
                    </div>
                    <label className="flex items-center gap-3 text-xs text-foreground/50"><span className="w-10 tabular-nums">{Math.round(control.volume * 100)}%</span><input aria-label={`${stem?.label ?? name} volume`} type="range" min="0" max="1" step="0.01" value={control.volume} onChange={(event) => update(name, { volume: Number(event.target.value) })} className="w-full accent-primary" /></label>
                    <a href={stemDownloadUrl(projectId, name)} download aria-label={`Download ${stem?.label ?? name} WAV`} className="grid h-10 w-10 place-items-center rounded-xl bg-foreground/5 text-foreground/70 transition hover:bg-primary hover:text-background"><DownloadIcon className="h-5 w-5" /></a>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
