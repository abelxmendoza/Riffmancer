import type { Tick } from '../beatmaker/conductor'
import { getGenre } from '../beatmaker/genres'
import { eventsForStep, holdLength, parseDrumPattern, STEPS, type BandEvent, type DrumGrid } from '../beatmaker/pattern'
import { scaleStepToMidi } from '../beatmaker/theory'
import { sectionAtBar, sectionStarts, totalBars, type Section, type SongSpec } from './spec'

export interface SongTick extends Tick {
  sectionIndex: number
  barInSection: number
  /** True on the step where the song wrapped back to the start (or the looped section restarted). */
  wrapped: boolean
}

const ENERGY_VELOCITY = { 1: 0.72, 2: 0.88, 3: 1 } as const

/** Melody note for one step, or undefined for a rest or hold. */
export function leadEvent(section: Section, stepInSection: number, degree: number, root: number, scale: SongSpec['scale']): BandEvent | undefined {
  const pattern = section.lead
  const index = stepInSection % pattern.length
  const symbol = pattern[index]
  if (!/[0-9]/.test(symbol)) return undefined
  const note = scaleStepToMidi(degree - 1 + Number(symbol), root, scale, 60)
  return { part: 'lead', notes: [note], steps: holdLength(pattern, index), velocity: 0.85 }
}

/**
 * Walks through a song's sections and says what plays on every 16th note. Pure, so the whole
 * arrangement logic is tested without audio.
 */
export class SongConductor {
  /** Absolute bar from the top of the song. */
  bar = 0
  step = 0
  /** While set, playback repeats this section (by index) instead of moving on. */
  loopSection: number | undefined
  private startBar = 0
  private gridCache = new Map<string, DrumGrid>()

  constructor(private readonly song: () => SongSpec) {}

  /** Starts from the top of a section next time playback (re)starts. */
  startAt(sectionIndex: number) {
    const starts = sectionStarts(this.song())
    this.startBar = starts[Math.max(0, Math.min(starts.length - 1, sectionIndex))] ?? 0
    this.reset()
  }

  reset() {
    this.bar = this.startBar
    this.step = 0
  }

  private grid(drums: Section['drums']): DrumGrid {
    const key = JSON.stringify(drums)
    let grid = this.gridCache.get(key)
    if (!grid) {
      grid = parseDrumPattern(drums)
      if (this.gridCache.size > 200) this.gridCache.clear()
      this.gridCache.set(key, grid)
    }
    return grid
  }

  tick(): SongTick {
    const song = this.song()
    let wrapped = false
    const total = totalBars(song)
    if (this.bar >= total) { this.bar = 0; wrapped = true }
    let { index, barInSection } = sectionAtBar(song, this.bar)
    if (this.loopSection !== undefined && this.loopSection < song.sections.length && index !== this.loopSection) {
      // Jump into the looped section (it may have been chosen mid-song, or the song was edited).
      this.bar = sectionStarts(song)[this.loopSection]
      ;({ index, barInSection } = sectionAtBar(song, this.bar))
      wrapped = this.step === 0
    }
    const section = song.sections[index]
    const genre = getGenre(song.genreId)
    const degree = section.progression[barInSection % section.progression.length] ?? 1
    const lastBar = barInSection === section.bars - 1
    const fill = section.fill && lastBar && section.parts.drums
    const grid = fill ? this.grid(genre.drums.fill) : this.grid(section.drums)
    const harmony = { root: song.root, scale: song.scale, degree }
    const events = eventsForStep({ step: this.step, grid, bass: section.bass, chords: section.chords, voicing: genre.voicing, harmony, parts: section.parts })

    if (this.step === 0 && barInSection === 0 && section.parts.drums && index > 0) {
      const previous = song.sections[index - 1]
      const loud = section.energy >= 2 || previous.fill
      if (loud && !events.some((event) => event.part === 'drums' && event.voice === 'crash')) events.push({ part: 'drums', voice: 'crash', velocity: 1 })
    }
    if (section.parts.lead) {
      const lead = leadEvent(section, barInSection * STEPS + this.step, degree, song.root, song.scale)
      if (lead) events.push(lead)
    }
    const scale = ENERGY_VELOCITY[section.energy]
    const scaled = events.map((event) => ({ ...event, velocity: Math.min(1, event.velocity * scale) }))

    const tick: SongTick = { step: this.step, bar: this.bar, degree, fill, events: scaled, sectionIndex: index, barInSection, wrapped }
    this.step += 1
    if (this.step >= STEPS) {
      this.step = 0
      this.bar += 1
      if (this.loopSection !== undefined && lastBar) this.bar = sectionStarts(song)[index]
    }
    return tick
  }
}
