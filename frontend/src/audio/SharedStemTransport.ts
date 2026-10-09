import type { StemName } from '../types'

export interface StemControl {
  muted: boolean
  soloed: boolean
  volume: number
}

export type StemControls = Record<StemName, StemControl>

export const STEM_NAMES: StemName[] = ['vocals', 'drums', 'bass', 'other']

export function resolveStemGain(stem: StemName, controls: StemControls): number {
  const anySoloed = STEM_NAMES.some((name) => controls[name].soloed)
  const control = controls[stem]
  const audible = !control.muted && (!anySoloed || control.soloed)
  return audible ? control.volume : 0
}

export class SharedTransportClock {
  private offset = 0
  private startedAt: number | null = null

  constructor(private durationSeconds = 0) {}

  setDuration(durationSeconds: number): void {
    this.durationSeconds = Math.max(0, durationSeconds)
    this.offset = Math.min(this.offset, this.durationSeconds)
  }

  play(now: number): void {
    if (this.startedAt === null) this.startedAt = now
  }

  pause(now: number): void {
    this.offset = this.position(now)
    this.startedAt = null
  }

  seek(seconds: number, now: number): void {
    this.offset = Math.min(this.durationSeconds, Math.max(0, seconds))
    if (this.startedAt !== null) this.startedAt = now
  }

  position(now: number): number {
    const elapsed = this.startedAt === null ? 0 : Math.max(0, now - this.startedAt)
    return Math.min(this.durationSeconds, this.offset + elapsed)
  }

  get playing(): boolean {
    return this.startedAt !== null
  }
}

export class SharedStemTransport {
  private context: AudioContext | null = null
  private buffers = new Map<StemName, AudioBuffer>()
  private gains = new Map<StemName, GainNode>()
  private sources = new Map<StemName, AudioBufferSourceNode>()
  private controls: StemControls
  readonly clock = new SharedTransportClock()
  duration = 0

  constructor(controls: StemControls) {
    this.controls = controls
  }

  async load(urls: Record<StemName, string>): Promise<void> {
    await this.destroy()
    const context = new AudioContext()
    this.context = context
    const decoded = await Promise.all(STEM_NAMES.map(async (name) => {
      const response = await fetch(urls[name])
      if (!response.ok) throw new Error(`${name} stem could not be loaded (${response.status}).`)
      try {
        return [name, await context.decodeAudioData(await response.arrayBuffer())] as const
      } catch {
        throw new Error(`${name} stem could not be decoded by this browser.`)
      }
    }))
    for (const [name, buffer] of decoded) {
      this.buffers.set(name, buffer)
      const gain = context.createGain()
      gain.connect(context.destination)
      this.gains.set(name, gain)
    }
    this.duration = Math.max(...decoded.map(([, buffer]) => buffer.duration))
    this.clock.setDuration(this.duration)
    this.applyControls(this.controls)
  }

  async play(): Promise<void> {
    const context = this.requireContext()
    if (this.clock.position(context.currentTime) >= this.duration) this.clock.seek(0, context.currentTime)
    await context.resume()
    this.stopSources()
    const when = context.currentTime + 0.04
    const offset = this.clock.position(context.currentTime)
    for (const name of STEM_NAMES) {
      const source = context.createBufferSource()
      source.buffer = this.buffers.get(name) ?? null
      source.connect(this.gains.get(name)!)
      source.start(when, offset)
      this.sources.set(name, source)
    }
    this.clock.play(when)
  }

  pause(): void {
    if (!this.context) return
    this.clock.pause(this.context.currentTime)
    this.stopSources()
  }

  async seek(seconds: number): Promise<void> {
    const context = this.requireContext()
    const wasPlaying = this.clock.playing
    if (wasPlaying) this.clock.pause(context.currentTime)
    this.stopSources()
    this.clock.seek(seconds, context.currentTime)
    if (wasPlaying) await this.play()
  }

  applyControls(controls: StemControls): void {
    this.controls = controls
    if (!this.context) return
    for (const name of STEM_NAMES) {
      this.gains.get(name)?.gain.setValueAtTime(resolveStemGain(name, controls), this.context.currentTime)
    }
  }

  position(): number {
    return this.context ? this.clock.position(this.context.currentTime) : 0
  }

  get playing(): boolean {
    return this.clock.playing
  }

  async destroy(): Promise<void> {
    this.stopSources()
    this.buffers.clear()
    this.gains.clear()
    this.clock.pause(this.context?.currentTime ?? 0)
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.context = null
    this.duration = 0
    this.clock.setDuration(0)
  }

  private stopSources(): void {
    for (const source of this.sources.values()) {
      try { source.stop() } catch { /* already stopped */ }
      source.disconnect()
    }
    this.sources.clear()
  }

  private requireContext(): AudioContext {
    if (!this.context || this.buffers.size !== STEM_NAMES.length) throw new Error('Stem audio is not loaded.')
    return this.context
  }
}
