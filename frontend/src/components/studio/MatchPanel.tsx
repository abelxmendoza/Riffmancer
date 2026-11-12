import { useEffect, useRef, useState } from 'react'
import type { VocalMatch } from '../../studio/analysis/vocalMatch'

type Stage = { kind: 'pick' } | { kind: 'recording'; seconds: number } | { kind: 'listening'; name: string } | { kind: 'done'; name: string; match: VocalMatch } | { kind: 'error'; message: string }

const MAX_RECORD = 30
const CONFIDENCE_STYLE = { high: 'bg-primary/20 text-primary', medium: 'bg-secondary/20 text-secondary', low: 'bg-foreground/10 text-foreground/55' } as const

/** Decodes audio and runs the estimate, skipping a quiet intro on long songs. */
async function analyse(blob: Blob): Promise<VocalMatch> {
  const [{ analyzeVocalEffects }, bytes] = await Promise.all([import('../../studio/analysis/vocalMatch'), blob.arrayBuffer()])
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new AudioContextClass()
  try {
    const buffer = await context.decodeAudioData(bytes)
    const skip = buffer.duration > 60 ? Math.min(20, buffer.duration * 0.1) : 0
    const from = Math.floor(skip * buffer.sampleRate)
    const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, index) => buffer.getChannelData(index).subarray(from))
    // Give the "Listening…" message a frame to paint before the number crunching.
    await new Promise((resolve) => setTimeout(resolve, 30))
    return analyzeVocalEffects({ sampleRate: buffer.sampleRate, channels })
  } finally {
    void context.close()
  }
}

/**
 * "Copy the vocal sound from a song": upload a song or record one playing nearby, get an
 * estimate of its vocal effects, and save it as a preset for your own voice.
 */
export function MatchPanel({ onSave, onClose }: { onSave: (name: string, match: VocalMatch) => void; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' })
  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const recorder = useRef<{ media: MediaRecorder; stream: MediaStream; timer: number } | undefined>(undefined)

  useEffect(() => () => {
    const current = recorder.current
    if (current) { window.clearInterval(current.timer); current.stream.getTracks().forEach((track) => track.stop()) }
  }, [])

  const run = async (blob: Blob, label: string) => {
    setStage({ kind: 'listening', name: label })
    try {
      const match = await analyse(blob)
      setName(`Like ${label}`.slice(0, 40))
      setStage({ kind: 'done', name: label, match })
    } catch (reason) {
      setStage({ kind: 'error', message: reason instanceof Error && reason.message ? reason.message : "Couldn't read that audio. Try an MP3, WAV or M4A." })
    }
  }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStage({ kind: 'error', message: "This browser can't record. Try Chrome, Edge, Firefox or Safari." })
      return
    }
    try {
      // Effects processing off: we want to hear the song's own reverb and echo, not the browser's cleanup.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const media = new MediaRecorder(stream)
      const chunks: Blob[] = []
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        void run(new Blob(chunks, { type: media.mimeType }), 'the recording')
      }
      let seconds = 0
      const timer = window.setInterval(() => {
        seconds++
        setStage({ kind: 'recording', seconds })
        if (seconds >= MAX_RECORD) stopRecording()
      }, 1000)
      recorder.current = { media, stream, timer }
      media.start()
      setStage({ kind: 'recording', seconds: 0 })
    } catch {
      setStage({ kind: 'error', message: 'Microphone access was blocked. Allow the mic for this site and try again.' })
    }
  }

  const stopRecording = () => {
    const current = recorder.current
    if (!current) return
    recorder.current = undefined
    window.clearInterval(current.timer)
    if (current.media.state !== 'inactive') current.media.stop()
  }

  return (
    <section aria-label="Copy a song's vocal sound" className="rounded-2xl border border-secondary/40 bg-secondary/5 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Copy a song's vocal sound</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 rounded-full px-2 text-foreground/50 hover:text-foreground">×</button>
      </div>

      {(stage.kind === 'pick' || stage.kind === 'error') && (
        <div className="mt-2 space-y-2">
          <p className="text-xs leading-5 text-foreground/65">Upload a song you like, or play it near your mic. I'll estimate the reverb, echo, tone, grit, width and compression on the voice and turn it into a preset for yours.</p>
          {stage.kind === 'error' && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-200">{stage.message}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-black text-background hover:brightness-110">Upload a song</button>
            <button type="button" onClick={() => void startRecording()} className="rounded-full border border-secondary px-3 py-1.5 text-xs font-black text-secondary hover:bg-secondary hover:text-background">● Record it playing</button>
          </div>
          <input ref={fileInput} type="file" accept="audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(file, `"${file.name.replace(/\.[a-z0-9]+$/i, '')}"`) }} />
          <p className="text-[11px] leading-4 text-foreground/45">Works best on a part where the voice is loud, or on an acapella. Everything stays in this browser.</p>
        </div>
      )}

      {stage.kind === 'recording' && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-foreground/70">Recording… {stage.seconds}s of {MAX_RECORD}s. Play the part with the most singing, loud and close to the mic.</p>
          <button type="button" onClick={stopRecording} disabled={stage.seconds < 5} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-40">{stage.seconds < 5 ? 'Keep going…' : '■ Stop and listen'}</button>
        </div>
      )}

      {stage.kind === 'listening' && <p className="mt-2 text-xs text-foreground/70" role="status">Listening to {stage.name}…</p>}

      {stage.kind === 'done' && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-foreground/65">My best guess from {Math.round(stage.match.seconds)}s of {stage.name}. These are estimates; tweak anything after.</p>
          <ul className="space-y-1">
            {stage.match.traits.map((trait) => (
              <li key={trait.id} className="flex items-baseline gap-2 text-xs">
                <span className="w-24 shrink-0 font-bold text-foreground/80">{trait.label}</span>
                <span className="min-w-0 flex-1 text-foreground/70">{trait.reading}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${CONFIDENCE_STYLE[trait.confidence]}`} title="How sure I am">{trait.confidence}</span>
              </li>
            ))}
          </ul>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/55">Preset name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onSave(name.trim() || 'Copied vocal', stage.match)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-black text-background hover:bg-secondary">Save and use on this track</button>
            <button type="button" onClick={() => setStage({ kind: 'pick' })} className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:text-foreground">Try another</button>
          </div>
        </div>
      )}
    </section>
  )
}
