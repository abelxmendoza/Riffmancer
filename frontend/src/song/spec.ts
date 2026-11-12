import type { MixPart, SynthPart } from '../beatmaker/engine/types'
import { DRUM_VOICES, type DrumPatternText, type KitPatch, type SynthPatch } from '../beatmaker/genres'
import { SCALES, type ScaleName } from '../beatmaker/theory'

/**
 * A whole song as plain data. Fret writes and edits it, the player reads it, and it is saved
 * in the browser. No audio code here, so every rule can be unit-tested.
 */

export const SECTION_KINDS = ['intro', 'verse', 'build', 'chorus', 'drop', 'bridge', 'breakdown', 'break', 'outro'] as const
export type SectionKind = (typeof SECTION_KINDS)[number]

export const SECTION_LABELS: Record<SectionKind, string> = {
  intro: 'Intro',
  verse: 'Verse',
  build: 'Build',
  chorus: 'Chorus',
  drop: 'Drop',
  bridge: 'Bridge',
  breakdown: 'Breakdown',
  break: 'Break',
  outro: 'Outro',
}

export type Energy = 1 | 2 | 3

export interface SectionParts {
  drums: boolean
  bass: boolean
  chords: boolean
  lead: boolean
}

export const SONG_PARTS: (keyof SectionParts)[] = ['drums', 'bass', 'chords', 'lead']

export interface Section {
  id: string
  kind: SectionKind
  bars: number
  /** 1 = quiet, 2 = normal, 3 = full power. Scales how hard everything is played. */
  energy: Energy
  /** One chord per bar as scale degrees 1–7; repeats if the section is longer. */
  progression: number[]
  /** One 16-character line per drum (see DrumPatternText). */
  drums: DrumPatternText
  /** Bass rhythm relative to the chord (same notation as genres). */
  bass: string
  /** Chord rhythm (same notation as genres). */
  chords: string
  /**
   * Melody, a multiple of 16 characters that repeats. Digits 0–9 are steps up the scale from the
   * current chord's root (0 root, 2 third, 4 fifth, 7 octave), `-` holds, `.` rests.
   */
  lead: string
  parts: SectionParts
  /** Play the genre's drum fill on the last bar. */
  fill: boolean
}

export interface SongSpec {
  version: 1
  title: string
  genreId: string
  bpm: number
  swing: number
  root: number
  scale: ScaleName
  sections: Section[]
  sounds: Record<SynthPart, SynthPatch>
  kit: KitPatch
  levels: Record<MixPart, number>
  /** Seed for the next random choice, so "surprise me" is repeatable in tests. */
  seed: number
}

export const STEPS_PER_BAR = 16
export const MAX_SECTIONS = 16
export const MAX_BARS = 32

export function totalBars(song: SongSpec): number {
  return song.sections.reduce((sum, section) => sum + section.bars, 0)
}

/** Where each section starts, in bars from the top of the song. */
export function sectionStarts(song: SongSpec): number[] {
  const starts: number[] = []
  let bar = 0
  for (const section of song.sections) {
    starts.push(bar)
    bar += section.bars
  }
  return starts
}

/** Finds the section that contains a bar of the song. */
export function sectionAtBar(song: SongSpec, bar: number): { index: number; barInSection: number } {
  let start = 0
  for (let index = 0; index < song.sections.length; index += 1) {
    const { bars } = song.sections[index]
    if (bar < start + bars) return { index, barInSection: bar - start }
    start += bars
  }
  return { index: Math.max(0, song.sections.length - 1), barInSection: 0 }
}

/** "Verse 2", "Chorus 3": the name a person would use for a section. */
export function sectionName(song: SongSpec, index: number): string {
  const section = song.sections[index]
  const sameKind = song.sections.filter((other) => other.kind === section.kind)
  if (sameKind.length === 1) return SECTION_LABELS[section.kind]
  const number = song.sections.slice(0, index + 1).filter((other) => other.kind === section.kind).length
  return `${SECTION_LABELS[section.kind]} ${number}`
}

export function formatDuration(song: SongSpec): string {
  const seconds = Math.round((totalBars(song) * 4 * 60) / song.bpm)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const PATTERN = /^[RrR3578\-.]{16}$/
const CHORD_PATTERN = /^[Xxm\-.]{16}$/
const LEAD_PATTERN = /^([0-9\-.]{16}){1,4}$/
const DRUM_LINE = /^[Xxo.]{16}$/

/** Checks one section; returns a list of problems in plain words (empty when it is fine). */
export function sectionProblems(section: Section): string[] {
  const problems: string[] = []
  if (!SECTION_KINDS.includes(section.kind)) problems.push(`unknown section kind "${section.kind}"`)
  if (!Number.isInteger(section.bars) || section.bars < 1 || section.bars > MAX_BARS) problems.push(`bars must be 1–${MAX_BARS}`)
  if (![1, 2, 3].includes(section.energy)) problems.push('energy must be 1, 2 or 3')
  if (!section.progression.length || section.progression.some((degree) => !Number.isInteger(degree) || degree < 1 || degree > 7)) problems.push('progression must be scale degrees 1–7')
  if (!PATTERN.test(section.bass)) problems.push('bass must be 16 characters of R r 3 5 7 8 - .')
  if (!CHORD_PATTERN.test(section.chords)) problems.push('chords must be 16 characters of X x m - .')
  if (!LEAD_PATTERN.test(section.lead)) problems.push('lead must be 16, 32, 48 or 64 characters of 0-9 - .')
  for (const [voice, line] of Object.entries(section.drums)) {
    if (!DRUM_VOICES.includes(voice as never)) problems.push(`unknown drum "${voice}"`)
    else if (typeof line !== 'string' || !DRUM_LINE.test(line)) problems.push(`drum line for ${voice} must be 16 characters of X x o .`)
  }
  return problems
}

export function songProblems(song: SongSpec): string[] {
  const problems: string[] = []
  if (!song.sections.length) problems.push('a song needs at least one section')
  if (song.sections.length > MAX_SECTIONS) problems.push(`a song can have at most ${MAX_SECTIONS} sections`)
  if (!(song.scale in SCALES)) problems.push(`unknown scale "${song.scale}"`)
  if (song.bpm < 60 || song.bpm > 240) problems.push('tempo must be 60–240 BPM')
  if (!Number.isInteger(song.root) || song.root < 0 || song.root > 11) problems.push('key root must be 0–11')
  song.sections.forEach((section, index) => sectionProblems(section).forEach((problem) => problems.push(`section ${index + 1}: ${problem}`)))
  return problems
}

export function isSongSpec(value: unknown): value is SongSpec {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SongSpec>
  if (candidate.version !== 1 || typeof candidate.genreId !== 'string' || !Array.isArray(candidate.sections)) return false
  if (!candidate.sounds?.bass || !candidate.sounds?.chords || !candidate.sounds?.lead || !candidate.kit || !candidate.levels) return false
  try {
    return songProblems(candidate as SongSpec).length === 0
  } catch {
    return false
  }
}
