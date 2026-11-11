import type { GenreDefinition } from './genres'
import { eventsForStep, parseDrumPattern, STEPS, type BandEvent, type DrumGrid } from './pattern'
import type { ScaleName } from './theory'

export type Variation = 'main' | 'alt'

/** The part of the song the backing band needs on every step. */
export interface BandSong {
  genre: GenreDefinition
  grids: Record<Variation, DrumGrid>
  variation: Variation
  progression: number[]
  root: number
  scale: ScaleName
  parts: { drums: boolean; bass: boolean; chords: boolean }
}

export interface Tick {
  step: number
  bar: number
  degree: number
  fill: boolean
  events: BandEvent[]
}

/**
 * Decides what the backing band plays on each 16th note: which drum grid, which chord,
 * fills, and the crash after a fill. Contains no audio code so it can be tested directly.
 */
export class Conductor {
  step = 0
  bar = 0
  /** A chord the player chose; while set, the band stays on it instead of the progression. */
  liveDegree: number | undefined
  private fillQueued = false
  private inFill = false
  private crashNext = false
  private fillGridCache?: { genreId: string; grid: DrumGrid }

  constructor(private readonly song: () => BandSong) {}

  reset() {
    this.step = 0
    this.bar = 0
    this.fillQueued = false
    this.inFill = false
    this.crashNext = false
  }

  queueFill() {
    this.fillQueued = true
  }

  get fillPending() {
    return this.fillQueued
  }

  degreeForBar(bar: number): number {
    if (this.liveDegree !== undefined) return this.liveDegree
    const { progression } = this.song()
    return progression.length ? progression[bar % progression.length] : 1
  }

  private fillGrid(genre: GenreDefinition): DrumGrid {
    if (this.fillGridCache?.genreId !== genre.id) this.fillGridCache = { genreId: genre.id, grid: parseDrumPattern(genre.drums.fill) }
    return this.fillGridCache.grid
  }

  /** Produces the events for the current step, then advances one step. */
  tick(): Tick {
    const song = this.song()
    if (this.step === 0) {
      if (this.inFill) this.crashNext = true
      this.inFill = this.fillQueued
      this.fillQueued = false
    }
    const degree = this.degreeForBar(this.bar)
    const grid = this.inFill ? this.fillGrid(song.genre) : song.grids[song.variation]
    const events = eventsForStep({
      step: this.step,
      grid,
      bass: song.genre.bass,
      chords: song.genre.chords,
      voicing: song.genre.voicing,
      harmony: { root: song.root, scale: song.scale, degree },
      parts: song.parts,
    })
    if (this.step === 0 && this.crashNext) {
      if (song.parts.drums && !events.some((event) => event.part === 'drums' && event.voice === 'crash')) {
        events.push({ part: 'drums', voice: 'crash', velocity: 1 })
      }
      this.crashNext = false
    }
    const tick: Tick = { step: this.step, bar: this.bar, degree, fill: this.inFill, events }
    this.step += 1
    if (this.step >= STEPS) {
      this.step = 0
      this.bar += 1
    }
    return tick
  }
}

/** Converts a transport position in ticks to the nearest 16th-note step in the bar. */
export function quantizeStep(ticks: number, ppq: number): number {
  return Math.round(ticks / (ppq / 4)) % STEPS
}
