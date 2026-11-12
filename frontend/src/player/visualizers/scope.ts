import type { CanvasVisualizer } from './types'

/** A glowing oscilloscope with phosphor trails. Shows the actual waveform, so distortion looks distorted. */
export const scope: CanvasVisualizer = {
  id: 'scope',
  name: 'Oscilloscope',
  blurb: 'Raw waveform with phosphor trails',
  create: () => (ctx, frame) => {
    const { width, height, theme, dpr, waveform, bands } = frame
    // Paint a see-through background instead of clearing, so the old lines fade like a CRT.
    ctx.globalAlpha = 0.24
    ctx.fillStyle = theme.background
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1

    const mid = height / 2
    const amplitude = height * (0.32 + bands.bass * 0.18)
    const lines: { color: string; offset: number; widthScale: number }[] = [
      { color: theme.colors[1], offset: 6 * dpr * frame.pulse, widthScale: 3 },
      { color: theme.accent, offset: 0, widthScale: 1.6 },
    ]
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.shadowColor = theme.accent
    ctx.shadowBlur = 18 * dpr
    for (const line of lines) {
      ctx.beginPath()
      ctx.strokeStyle = line.color
      ctx.lineWidth = line.widthScale * dpr * (1 + bands.level)
      const step = Math.max(1, Math.floor(waveform.length / 512))
      for (let index = 0; index < waveform.length; index += step) {
        const x = (index / (waveform.length - 1)) * width
        const y = mid + ((waveform[index] - 128) / 128) * amplitude + line.offset
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Grid like a real scope.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = dpr
    for (let index = 1; index < 8; index += 1) {
      const x = (width / 8) * index
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke()
    }
    for (let index = 1; index < 4; index += 1) {
      const y = (height / 4) * index
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }
  },
}
