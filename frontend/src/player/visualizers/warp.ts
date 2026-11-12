import { smooth } from '../analysis'
import { colorAt } from '../themes'
import type { CanvasVisualizer } from './types'

interface Star { x: number; y: number; z: number; pz: number; hue: number }

/** Flying through a star tunnel. The bass is the throttle; a drop punches you into hyperspace. */
export const warp: CanvasVisualizer = {
  id: 'warp',
  name: 'Hyperspace',
  blurb: 'Star tunnel, the bass is the throttle',
  create: () => {
    const stars: Star[] = Array.from({ length: 700 }, () => {
      const z = Math.random()
      return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z, pz: z, hue: Math.random() }
    })
    let speed = 0.004
    let twist = 0
    return (ctx, frame) => {
      const { width, height, theme, dpr, bands } = frame
      ctx.globalAlpha = 0.35
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
      speed = smooth(speed, 0.003 + bands.bass ** 2 * 0.05 + frame.pulse * 0.02, 0.4, 0.05)
      twist += bands.treble * 0.01
      const cx = width / 2
      const cy = height / 2
      const focal = Math.max(width, height) * 0.5
      ctx.lineCap = 'round'
      for (const star of stars) {
        star.pz = star.z
        star.z -= speed
        if (star.z <= 0.01) {
          star.x = Math.random() * 2 - 1
          star.y = Math.random() * 2 - 1
          star.z = 1
          star.pz = 1
          continue
        }
        const cos = Math.cos(twist)
        const sin = Math.sin(twist)
        const rx = star.x * cos - star.y * sin
        const ry = star.x * sin + star.y * cos
        const sx = cx + (rx / star.z) * focal * 0.5
        const sy = cy + (ry / star.z) * focal * 0.5
        const px = cx + (rx / star.pz) * focal * 0.5
        const py = cy + (ry / star.pz) * focal * 0.5
        if (sx < 0 || sx > width || sy < 0 || sy > height) continue
        const near = 1 - star.z
        ctx.strokeStyle = colorAt(theme, star.hue * 0.5 + near * 0.5)
        ctx.globalAlpha = Math.min(1, near * 1.6)
        ctx.lineWidth = Math.max(0.6, near * 3.2) * dpr
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(sx, sy)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      // A pulsing core in the vanishing point.
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * (0.12 + bands.bass * 0.2))
      core.addColorStop(0, `${theme.accent}aa`)
      core.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = core
      ctx.fillRect(0, 0, width, height)
    }
  },
}
