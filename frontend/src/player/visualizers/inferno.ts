import { logBars } from '../analysis'
import { colorAt } from '../themes'
import type { CanvasVisualizer } from './types'

interface Ember { x: number; y: number; vx: number; vy: number; life: number; size: number; heat: number }

/** Embers erupt from the floor where the frequencies are loudest. Kicks make it spew. */
export const inferno: CanvasVisualizer = {
  id: 'inferno',
  name: 'Inferno',
  blurb: 'Every frequency spits fire',
  create: () => {
    let embers: Ember[] = []
    return (ctx, frame) => {
      const { width, height, theme, dpr, bands } = frame
      ctx.globalAlpha = 0.28
      ctx.fillStyle = theme.background
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
      const columns = 40
      const bars = logBars(frame.frequency, columns, frame.sampleRate)
      for (let index = 0; index < columns; index += 1) {
        const energy = bars[index] ** 2
        const spawn = (Math.random() < energy * 1.4 ? 1 : 0) + (Math.random() < energy * 0.5 ? 1 : 0) + (frame.beat && Math.random() < 0.6 ? 1 : 0)
        for (let count = 0; count < spawn; count += 1) {
          if (embers.length > 900) break
          embers.push({
            x: ((index + Math.random()) / columns) * width,
            y: height + 4 * dpr,
            vx: (Math.random() - 0.5) * 1.5 * dpr,
            vy: -(2 + energy * 9 + bands.bass * 4) * dpr * (0.6 + Math.random() * 0.6),
            life: 1,
            size: (1 + Math.random() * 2.2 + energy * 2.5) * dpr,
            heat: Math.min(1, energy + 0.3),
          })
        }
      }
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      embers = embers.filter((ember) => ember.life > 0.02 && ember.y > -20)
      for (const ember of embers) {
        ember.x += ember.vx + Math.sin(frame.time * 3 + ember.y * 0.01) * 0.6 * dpr
        ember.y += ember.vy
        ember.vy *= 0.985
        ember.life *= 0.975
        ctx.globalAlpha = ember.life * 0.7
        ctx.fillStyle = colorAt(theme, ember.heat * ember.life + 0.1)
        ctx.beginPath()
        ctx.arc(ember.x, ember.y, ember.size * (0.5 + ember.life * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      ctx.globalAlpha = 1
      const floorGlow = ctx.createLinearGradient(0, height, 0, height * 0.6)
      floorGlow.addColorStop(0, `${theme.accent}${Math.round(20 + bands.bass * 70).toString(16).padStart(2, '0')}`)
      floorGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = floorGlow
      ctx.fillRect(0, height * 0.6, width, height * 0.4)
    }
  },
}
