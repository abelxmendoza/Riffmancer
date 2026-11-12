import { logBars, smooth } from '../analysis'
import { colorAt } from '../themes'
import type { CanvasVisualizer } from './types'

/** Mirrored log-scale bars with falling peak caps and a reflection. */
export const spectrum: CanvasVisualizer = {
  id: 'spectrum',
  name: 'Spectrum',
  blurb: 'Classic bars, lows in the middle',
  create: () => {
    const count = 48
    let levels = new Array<number>(count).fill(0)
    let peaks = new Array<number>(count).fill(0)
    return (ctx, frame) => {
      const { width, height, theme, dpr } = frame
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, width, height)
      const bars = logBars(frame.frequency, count, frame.sampleRate)
      levels = levels.map((value, index) => smooth(value, bars[index], 0.7, 0.18))
      peaks = peaks.map((value, index) => Math.max(levels[index], value - 0.008))

      const floor = height * 0.72
      const maxHeight = floor * 0.92
      const slot = width / 2 / count
      const gap = Math.max(1, slot * 0.22)
      const gradient = ctx.createLinearGradient(0, floor, 0, floor - maxHeight)
      theme.colors.forEach((color, index) => gradient.addColorStop(index / (theme.colors.length - 1), color))

      ctx.save()
      ctx.shadowColor = theme.accent
      ctx.shadowBlur = 12 * dpr + frame.pulse * 30 * dpr
      for (let index = 0; index < count; index += 1) {
        const barHeight = Math.max(2 * dpr, levels[index] ** 1.4 * maxHeight)
        const peakY = floor - peaks[index] ** 1.4 * maxHeight
        for (const side of [-1, 1]) {
          const x = width / 2 + side * (index * slot) - (side < 0 ? slot : 0) + gap / 2
          ctx.fillStyle = gradient
          ctx.fillRect(x, floor - barHeight, slot - gap, barHeight)
          ctx.fillStyle = colorAt(theme, peaks[index] + 0.3)
          ctx.fillRect(x, peakY - 3 * dpr, slot - gap, 3 * dpr)
        }
      }
      ctx.restore()

      // Reflection on the floor.
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.translate(0, floor * 2)
      ctx.scale(1, -1)
      ctx.drawImage(ctx.canvas, 0, 0, width, floor, 0, 0, width, floor)
      ctx.restore()
      const fade = ctx.createLinearGradient(0, floor, 0, height)
      fade.addColorStop(0, 'rgba(0,0,0,0)')
      fade.addColorStop(1, theme.background)
      ctx.fillStyle = fade
      ctx.fillRect(0, floor, width, height - floor)
    }
  },
}
