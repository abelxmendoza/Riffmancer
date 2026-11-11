import { useEffect, useRef } from 'react'
import { computePeaks } from '../../studio/timing'

/** Draws a clip's waveform on a canvas. `from`/`to` are seconds inside the audio. */
export function Waveform({ buffer, from, to, width, height, color }: { buffer?: AudioBuffer; from: number; to: number; width: number; height: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext?.('2d')
    if (!canvas || !context) return
    const ratio = window.devicePixelRatio || 1
    const pixels = Math.max(1, Math.min(8000, Math.round(width)))
    canvas.width = pixels * ratio
    canvas.height = height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, pixels, height)
    if (!buffer) return
    const start = Math.floor(from * buffer.sampleRate)
    const end = Math.min(buffer.length, Math.floor(to * buffer.sampleRate))
    if (end <= start) return
    const peaks = computePeaks(buffer.getChannelData(0).subarray(start, end), pixels)
    const middle = height / 2
    context.fillStyle = color
    for (let x = 0; x < pixels; x++) {
      const min = peaks[x * 2]
      const max = peaks[x * 2 + 1]
      const top = middle - max * middle * 0.95
      context.fillRect(x, top, 1, Math.max(1, (max - min) * middle * 0.95))
    }
  }, [buffer, from, to, width, height, color])
  return <canvas ref={ref} style={{ width, height }} className="block" aria-hidden="true" />
}

/** Horizontal level meter, -60 to 0 dBFS. */
export function LevelMeter({ db: raw, label }: { db: number; label: string }) {
  const db = raw > -60 ? raw : -Infinity
  const value = Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0
  const color = db > -1 ? 'bg-red-500' : db > -9 ? 'bg-yellow-400' : 'bg-primary'
  return (
    <div className="min-w-24" title={`${label}: ${Number.isFinite(db) ? `${db.toFixed(1)} dB` : 'silent'}`}>
      <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-foreground/45"><span>{label}</span><span className="font-mono">{Number.isFinite(db) ? db.toFixed(0) : '–∞'}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" role="meter" aria-label={label} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Number.isFinite(db) ? Math.round(db) : -60}>
        <div className={`h-full ${color} transition-[width] duration-75`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}
