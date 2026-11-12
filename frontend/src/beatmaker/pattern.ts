import { DRUM_VOICES, type DrumPatternText, type DrumVoice, type GenreDefinition } from './genres'
import { buildChord, degreeRoot, scaleStepToMidi, type ScaleName } from './theory'

export const STEPS = 16

/** Velocity per step (0 = silent) for every drum voice. */
export type DrumGrid = Record<DrumVoice, number[]>

export const ACCENT = 1
export const NORMAL = 0.75
export const GHOST = 0.4

const CHAR_VELOCITY: Record<string, number> = { X: ACCENT, x: NORMAL, o: GHOST }

export function emptyGrid(): DrumGrid {
  return Object.fromEntries(DRUM_VOICES.map((voice) => [voice, Array<number>(STEPS).fill(0)])) as DrumGrid
}

export function parseDrumPattern(text: DrumPatternText): DrumGrid {
  const grid = emptyGrid()
  for (const voice of DRUM_VOICES) {
    const line = text[voice]
    if (!line) continue
    for (let step = 0; step < STEPS; step += 1) grid[voice][step] = CHAR_VELOCITY[line[step]] ?? 0
  }
  return grid
}

/** The reverse of parseDrumPattern: back to one text line per drum (silent drums left out). */
export function gridToPattern(grid: DrumGrid): DrumPatternText {
  const text: DrumPatternText = {}
  for (const voice of DRUM_VOICES) {
    if (!grid[voice].some((velocity) => velocity > 0)) continue
    text[voice] = grid[voice].map((velocity) => (velocity >= ACCENT ? 'X' : velocity > GHOST ? 'x' : velocity > 0 ? 'o' : '.')).join('')
  }
  return text
}

export function cloneGrid(grid: DrumGrid): DrumGrid {
  return Object.fromEntries(DRUM_VOICES.map((voice) => [voice, [...grid[voice]]])) as DrumGrid
}

/** Clicking a step cycles off → normal → accent → ghost → off. */
export function cycleVelocity(velocity: number): number {
  if (velocity === 0) return NORMAL
  if (velocity === NORMAL) return ACCENT
  if (velocity === ACCENT) return GHOST
  return 0
}

/**
 * Genre-aware variation: keeps the backbone (kick on 1, the main snare hits) and
 * adds or removes a few extra notes so the beat stays in the style.
 */
export function mutateGrid(grid: DrumGrid, random: () => number = Math.random, amount = 0.15): DrumGrid {
  const next = cloneGrid(grid)
  for (const voice of DRUM_VOICES) {
    const active = grid[voice].some((velocity) => velocity > 0)
    if (!active && voice !== 'closedHat' && voice !== 'kick') continue
    for (let step = 0; step < STEPS; step += 1) {
      const backbone = (voice === 'kick' && step === 0) || (voice === 'snare' && grid.snare[step] === ACCENT)
      if (backbone || random() > amount) continue
      if (next[voice][step] > 0) next[voice][step] = voice === 'snare' ? GHOST : 0
      else next[voice][step] = step % 2 === 0 ? NORMAL : GHOST
    }
  }
  return next
}

export type BandEvent =
  | { part: 'drums'; voice: DrumVoice; velocity: number }
  | { part: 'bass'; notes: number[]; steps: number; velocity: number }
  | { part: 'chords'; notes: number[]; steps: number; velocity: number; muted: boolean }
  | { part: 'lead'; notes: number[]; steps: number; velocity: number }

export interface Harmony {
  root: number
  scale: ScaleName
  degree: number
}

/** Number of steps a note lasts: itself plus every following `-`. */
export function holdLength(pattern: string, step: number): number {
  let length = 1
  while (step + length < pattern.length && pattern[step + length] === '-') length += 1
  return length
}

/** Keeps the bass in a comfortable low register (E1–D#3). */
function bassRegister(midi: number): number {
  let note = midi
  while (note < 28) note += 12
  while (note > 51) note -= 12
  return note
}

export function bassNoteFor(symbol: string, harmony: Harmony): number | undefined {
  const step = harmony.degree - 1
  const at = (offset: number) => scaleStepToMidi(step + offset, harmony.root, harmony.scale, 24)
  const rootNote = bassRegister(degreeRoot(harmony.degree, harmony.root, harmony.scale, 24))
  const shift = rootNote - at(0)
  switch (symbol) {
    case 'R':
    case 'r':
      return rootNote
    case '3':
      return at(2) + shift
    case '5':
      return at(4) + shift
    case '7':
      return at(6) + shift
    case '8':
      return rootNote + 12
    default:
      return undefined
  }
}

/** Chord notes kept between C3 and B4 so changes don't jump around. */
export function chordNotesFor(harmony: Harmony, voicing: GenreDefinition['voicing']): number[] {
  const notes = buildChord(harmony.degree, harmony.root, harmony.scale, voicing, 48)
  const lowest = notes[0]
  const shift = lowest >= 55 ? -12 : 0
  return notes.map((note) => note + shift)
}

export interface StepInput {
  step: number
  grid: DrumGrid
  bass: string
  chords: string
  voicing: GenreDefinition['voicing']
  harmony: Harmony
  parts: { drums: boolean; bass: boolean; chords: boolean }
}

/** Everything the backing band plays on one 16th-note step. Pure so it can be tested without audio. */
export function eventsForStep({ step, grid, bass, chords, voicing, harmony, parts }: StepInput): BandEvent[] {
  const events: BandEvent[] = []
  if (parts.drums) {
    for (const voice of DRUM_VOICES) {
      const velocity = grid[voice][step]
      if (velocity > 0) events.push({ part: 'drums', voice, velocity })
    }
  }
  if (parts.bass) {
    const symbol = bass[step]
    const note = bassNoteFor(symbol, harmony)
    if (note !== undefined) events.push({ part: 'bass', notes: [note], steps: holdLength(bass, step), velocity: symbol === 'r' ? 0.6 : symbol === 'R' ? 1 : 0.8 })
  }
  if (parts.chords) {
    const symbol = chords[step]
    if (symbol === 'X' || symbol === 'x' || symbol === 'm') {
      events.push({
        part: 'chords',
        notes: chordNotesFor(harmony, voicing),
        steps: symbol === 'm' ? 0.5 : holdLength(chords, step),
        velocity: symbol === 'X' ? 1 : symbol === 'x' ? 0.8 : 0.65,
        muted: symbol === 'm',
      })
    }
  }
  return events
}
