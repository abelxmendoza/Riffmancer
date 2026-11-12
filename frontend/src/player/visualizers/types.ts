import type { Bands } from '../analysis'
import type { VisualTheme } from '../themes'

/** Everything a visualizer needs to draw one frame. */
export interface Frame {
  frequency: Uint8Array
  waveform: Uint8Array
  sampleRate: number
  bands: Bands
  /** True on the frame a kick or big hit lands. */
  beat: boolean
  /** 1 right on a beat, fading to 0. Good for flashes and bumps. */
  pulse: number
  /** Seconds since the visualizer started. */
  time: number
  /** Canvas size in device pixels. */
  width: number
  height: number
  dpr: number
  theme: VisualTheme
}

export type DrawFn = (context: CanvasRenderingContext2D, frame: Frame) => void

export interface CanvasVisualizer {
  id: string
  name: string
  blurb: string
  /** Makes a fresh drawing function with its own memory (trails, particles, peaks). */
  create: () => DrawFn
}
