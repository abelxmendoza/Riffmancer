import { useEffect, useRef, useState } from 'react'
import { BeatDetector, bandsFrom } from '../../player/analysis'
import type { PlayerEngine } from '../../player/engine'
import { createMilkDrop, supportsWebGL2, type MilkDrop } from '../../player/milkdrop'
import { getTheme } from '../../player/themes'
import { CANVAS_VISUALIZERS, type Frame } from '../../player/visualizers'

interface VisualizerProps {
  engine: PlayerEngine
  mode: string
  themeId: string
  /** Shake and flash on big hits. */
  beatFx: boolean
  /** True once the audio graph exists (after the first click on play). */
  graphReady: boolean
  /** Bump this number to jump to another MilkDrop preset. */
  tripSeed: number
  onPresetName?: (name: string) => void
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** The full-bleed canvas. Draws whichever visualizer is picked, every animation frame. */
export function Visualizer({ engine, mode, themeId, beatFx, graphReady, tripSeed, onPresetName }: VisualizerProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const shakeRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)
  const milkRef = useRef<MilkDrop | undefined>(undefined)
  const [milkError, setMilkError] = useState<string>()
  const isMilk = mode === 'milkdrop'
  const settings = useRef({ themeId, beatFx })
  settings.current = { themeId, beatFx }

  // MilkDrop: create once the audio graph exists, tear down when leaving the mode.
  useEffect(() => {
    if (!isMilk || !graphReady || !engine.context || !engine.source || !glRef.current) return
    if (!supportsWebGL2()) { setMilkError('MilkDrop needs WebGL 2, which this browser has turned off. Try Chrome or Edge.'); return }
    let cancelled = false
    const canvas = glRef.current
    const { width, height } = canvas
    createMilkDrop(engine.context, engine.source, canvas, width, height)
      .then((milk) => {
        if (cancelled) { milk.dispose(); return }
        milkRef.current = milk
        setMilkError(undefined)
        onPresetName?.(milk.presetName())
      })
      .catch((reason: unknown) => { console.error('MilkDrop failed to start', reason); setMilkError('MilkDrop could not start on this device.') })
    return () => {
      cancelled = true
      milkRef.current?.dispose()
      milkRef.current = undefined
    }
    // onPresetName is a setter from the parent; it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMilk, graphReady, engine])

  useEffect(() => {
    if (tripSeed > 0 && milkRef.current) onPresetName?.(milkRef.current.next())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripSeed])

  // Keep canvases sized to the box, in device pixels.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const { clientWidth, clientHeight } = wrap
      for (const canvas of [canvasRef.current, glRef.current]) {
        if (!canvas) continue
        const scale = canvas === glRef.current ? 1 : dpr
        canvas.width = Math.max(1, Math.round(clientWidth * scale))
        canvas.height = Math.max(1, Math.round(clientHeight * scale))
      }
      milkRef.current?.resize(Math.max(1, clientWidth), Math.max(1, clientHeight))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  // The animation loop.
  useEffect(() => {
    const visual = CANVAS_VISUALIZERS.find((item) => item.id === mode)
    const draw = visual?.create()
    const detector = new BeatDetector()
    const reduced = prefersReducedMotion()
    const started = performance.now()
    let pulse = 0
    let frameId = 0
    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop)
      engine.read()
      const bands = bandsFrom(engine.frequency, engine.sampleRate)
      const beat = detector.update(bands.bass, now)
      pulse = beat ? 1 : pulse * 0.88
      const { themeId: currentTheme, beatFx: fx } = settings.current

      if (shakeRef.current) {
        const amount = fx && !reduced ? pulse * pulse * 10 : 0
        shakeRef.current.style.transform = amount > 0.2 ? `translate(${(Math.random() - 0.5) * amount}px, ${(Math.random() - 0.5) * amount}px) scale(${1 + pulse * 0.012})` : ''
      }
      if (flashRef.current) flashRef.current.style.opacity = fx && !reduced ? String(pulse * pulse * 0.12) : '0'

      if (isMilk) { milkRef.current?.render(); return }
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context || !draw) return
      const frame: Frame = {
        frequency: engine.frequency,
        waveform: engine.waveform,
        sampleRate: engine.sampleRate,
        bands,
        beat,
        pulse,
        time: (now - started) / 1000,
        width: canvas.width,
        height: canvas.height,
        dpr: Math.min(2, window.devicePixelRatio || 1),
        theme: getTheme(currentTheme),
      }
      draw(context, frame)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [engine, mode, isMilk])

  const theme = getTheme(themeId)
  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" style={{ background: theme.background }}>
      <div ref={shakeRef} className="absolute inset-[-12px] will-change-transform">
        {/* Two canvases: a canvas can only ever be 2D or WebGL, never both. */}
        <canvas ref={canvasRef} aria-hidden className={`absolute inset-[12px] h-[calc(100%-24px)] w-[calc(100%-24px)] ${isMilk ? 'hidden' : ''}`} />
        <canvas ref={glRef} aria-hidden className={`absolute inset-[12px] h-[calc(100%-24px)] w-[calc(100%-24px)] ${isMilk ? '' : 'hidden'}`} />
      </div>
      <div ref={flashRef} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" style={{ background: theme.accent, mixBlendMode: 'screen' }} />
      {isMilk && !graphReady && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm font-bold text-foreground/60">Press play to start MilkDrop.</p>}
      {isMilk && milkError && <p role="alert" className="absolute inset-x-0 top-1/2 p-6 text-center text-sm font-bold text-red-200">{milkError}</p>}
    </div>
  )
}
