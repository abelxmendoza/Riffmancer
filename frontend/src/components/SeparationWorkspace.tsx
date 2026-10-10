import { useEffect, useState } from 'react'
import { getSeparation, startSeparation } from '../services/api'
import type { Project, SeparationJob } from '../types'
import { MixerIcon } from './Icons'
import { StemMixer } from './StemMixer'
import { WaveformPlayer } from './WaveformPlayer'

export function SeparationWorkspace({ project }: { project: Project }) {
  const [job, setJob] = useState<SeparationJob | null>(null)
  const [checking, setChecking] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string>()
  const [mode, setMode] = useState<'original' | 'stems'>('original')

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    setError(undefined)
    setMode('original')
    getSeparation(project.id)
      .then((result) => { if (!cancelled) setJob(result) })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not read separation status.') })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [project.id])

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) return
    const timer = window.setInterval(() => {
      getSeparation(project.id)
        .then((next) => {
          if (!next) return
          setJob(next)
          if (next.status === 'completed') setMode('stems')
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not refresh separation status.'))
    }, 800)
    return () => window.clearInterval(timer)
  }, [job?.status, project.id])

  const start = async () => {
    setStarting(true)
    setError(undefined)
    try {
      setJob(await startSeparation(project.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start separation.')
    } finally {
      setStarting(false)
    }
  }

  const active = job?.status === 'queued' || job?.status === 'running'
  const completed = job?.status === 'completed'
  const failed = job?.status === 'failed' || job?.status === 'interrupted'

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-foreground/10 bg-surface p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-primary/10 p-3 text-primary"><MixerIcon /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Demucs separation</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">Vocals, drums, bass, and other</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/50">Runs locally in a single background worker. The original recording is never modified.</p>
            </div>
          </div>
          {!completed ? <button type="button" disabled={starting || active || checking} onClick={() => void start()} className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-background transition hover:bg-secondary disabled:cursor-wait disabled:opacity-50">{active ? 'Processing…' : failed ? 'Try separation again' : 'Separate instruments'}</button> : null}
        </div>
        {active ? (
          <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary" /><p className="text-sm font-semibold text-foreground/80">{job.stage}</p></div>
            {job.progress !== null ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"><div className="h-full bg-primary" style={{ width: `${job.progress}%` }} /></div> : <p className="mt-2 text-xs text-foreground/50">This stage does not expose trustworthy percentage progress.</p>}
          </div>
        ) : null}
        {failed ? <p role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-200"><strong>{job.status === 'interrupted' ? 'Processing was interrupted. ' : 'Separation failed. '}</strong>{job.error_message}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-200">{error}</p> : null}
      </section>

      {completed ? (
        <div className="flex w-fit rounded-full border border-foreground/10 bg-surface p-1" aria-label="Playback source">
          <button type="button" aria-pressed={mode === 'original'} onClick={() => setMode('original')} className={`rounded-full px-5 py-2 text-sm font-bold transition ${mode === 'original' ? 'bg-primary text-background' : 'text-foreground/50 hover:text-foreground/80'}`}>Original</button>
          <button type="button" aria-pressed={mode === 'stems'} onClick={() => setMode('stems')} className={`rounded-full px-5 py-2 text-sm font-bold transition ${mode === 'stems' ? 'bg-primary text-background' : 'text-foreground/50 hover:text-foreground/80'}`}>Stems</button>
        </div>
      ) : null}

      {completed && mode === 'stems' && job ? <StemMixer projectId={project.id} job={job} /> : <WaveformPlayer project={project} />}
    </div>
  )
}
