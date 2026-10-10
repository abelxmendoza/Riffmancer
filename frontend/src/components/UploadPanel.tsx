import { useRef, useState } from 'react'
import { MusicIcon, UploadIcon } from './Icons'

interface UploadPanelProps {
  busy: boolean
  progress: number
  onFile: (file: File) => void
}

const accepted = '.wav,.mp3,.flac,.m4a,.aac,.ogg,audio/*'

export function UploadPanel({ busy, progress, onFile }: UploadPanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const choose = (file?: File) => {
    if (file && !busy) onFile(file)
  }

  return (
    <section
      className={`group relative overflow-hidden rounded-3xl border p-6 transition sm:p-8 ${dragging ? 'border-primary bg-primary/10' : 'border-foreground/10 bg-surface'}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />
      <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><MusicIcon /></div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">New session</p>
            <h2 className="text-xl font-bold text-foreground">Drop in a finished song</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-foreground/70">WAV, MP3, FLAC, M4A, AAC, or OGG · up to 500 MB · stays on this machine</p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex min-w-40 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-background transition hover:bg-secondary disabled:cursor-wait disabled:opacity-60"
        >
          <UploadIcon className="h-5 w-5" /> {busy ? `${progress}% uploaded` : 'Choose audio'}
        </button>
        <input ref={input} className="sr-only" type="file" accept={accepted} onChange={(event) => choose(event.target.files?.[0])} />
      </div>
      {busy && <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/10"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
    </section>
  )
}
