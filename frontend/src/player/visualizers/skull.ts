import { logBars, smooth } from '../analysis'
import { colorAt } from '../themes'
import type { CanvasVisualizer } from './types'

let emblem: HTMLImageElement | undefined
function getEmblem() {
  if (!emblem && typeof Image !== 'undefined') {
    emblem = new Image()
    emblem.src = '/riffmancer-emblem.webp'
  }
  return emblem
}

/** The Riffmancer skull at the centre, thumping on the kick, ringed by radial bars and beat shockwaves. */
export const skull: CanvasVisualizer = {
  id: 'skull',
  name: 'Skull Pulse',
  blurb: 'The emblem headbangs to your kick drum',
  create: () => {
    const count = 96
    let levels = new Array<number>(count).fill(0)
    let rings: { radius: number; alpha: number }[] = []
    let scale = 1
    let spin = 0
    return (ctx, frame) => {
      const { width, height, theme, dpr, bands } = frame
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      const base = Math.min(width, height) * 0.2
      scale = smooth(scale, 1 + bands.bass * 0.28 + frame.pulse * 0.08, 0.5, 0.15)
      spin += 0.002 + bands.mid * 0.01

      // Backglow.
      const glow = ctx.createRadialGradient(cx, cy, base * 0.6, cx, cy, base * 2.6)
      glow.addColorStop(0, `${theme.accent}${Math.round(18 + bands.bass * 30 + frame.pulse * 40).toString(16).padStart(2, '0')}`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      if (frame.beat) rings.push({ radius: base * scale, alpha: 0.9 })
      rings = rings.filter((ring) => ring.alpha > 0.02)
      ctx.save()
      for (const ring of rings) {
        ring.radius += 9 * dpr
        ring.alpha *= 0.93
        ctx.strokeStyle = theme.accent
        ctx.globalAlpha = ring.alpha
        ctx.lineWidth = 3 * dpr
        ctx.beginPath()
        ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // Radial bars, mirrored left/right so it looks symmetrical like a face.
      const bars = logBars(frame.frequency, count / 2, frame.sampleRate)
      const mirrored = [...bars, ...[...bars].reverse()]
      levels = levels.map((value, index) => smooth(value, mirrored[index], 0.7, 0.2))
      const inner = base * scale * 1.08
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(spin)
      ctx.lineCap = 'round'
      ctx.shadowColor = theme.accent
      ctx.shadowBlur = 10 * dpr
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2
        const length = 4 * dpr + levels[index] ** 1.3 * base * 1.5
        ctx.strokeStyle = colorAt(theme, levels[index] + 0.15)
        ctx.lineWidth = Math.max(2 * dpr, ((Math.PI * 2 * inner) / count) * 0.55)
        ctx.beginPath()
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        ctx.lineTo(Math.cos(angle) * (inner + length), Math.sin(angle) * (inner + length))
        ctx.stroke()
      }
      ctx.restore()

      // The emblem, clipped to a circle, with a slight headbang tilt on hits.
      const image = getEmblem()
      const size = base * 2 * scale
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.sin(frame.time * 8) * 0.04 * frame.pulse)
      ctx.beginPath()
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2)
      ctx.clip()
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, -size / 2, -size / 2, size, size)
      else { ctx.fillStyle = theme.colors[0]; ctx.fill() }
      ctx.restore()
      ctx.save()
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 3 * dpr
      ctx.shadowColor = theme.accent
      ctx.shadowBlur = 20 * dpr * (0.4 + frame.pulse)
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  },
}
