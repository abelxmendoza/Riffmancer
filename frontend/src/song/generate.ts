import { DEFAULT_LEVELS } from '../beatmaker/session'
import { DRUM_VOICES, getGenre, GENRES, type DrumPatternText, type DrumVoice, type GenreDefinition } from '../beatmaker/genres'
import type { ScaleName } from '../beatmaker/theory'
import { pick, seededRandom, newSeed, type Random } from './random'
import type { Energy, Section, SectionKind, SongSpec } from './spec'

/**
 * Turns a genre preset into a whole song: an arrangement of sections, each with its own drums,
 * chords, bass and melody. Built on the genre data files, so new genres get songs for free.
 */

export interface StructureItem {
  kind: SectionKind
  bars: number
}

const POP_FORM: StructureItem[] = [
  { kind: 'intro', bars: 4 }, { kind: 'verse', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'verse', bars: 8 },
  { kind: 'chorus', bars: 8 }, { kind: 'bridge', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'outro', bars: 4 },
]

/** Song shapes per genre. Anything not listed uses the verse/chorus form. */
export const STRUCTURES: Record<string, StructureItem[]> = {
  'post-punk': POP_FORM,
  metal: [
    { kind: 'intro', bars: 4 }, { kind: 'verse', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'verse', bars: 8 },
    { kind: 'chorus', bars: 8 }, { kind: 'breakdown', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'outro', bars: 4 },
  ],
  punk: [
    { kind: 'intro', bars: 2 }, { kind: 'verse', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'verse', bars: 8 },
    { kind: 'chorus', bars: 8 }, { kind: 'bridge', bars: 4 }, { kind: 'chorus', bars: 8 }, { kind: 'outro', bars: 2 },
  ],
  'drum-and-bass': [
    { kind: 'intro', bars: 8 }, { kind: 'build', bars: 8 }, { kind: 'drop', bars: 16 }, { kind: 'break', bars: 8 },
    { kind: 'build', bars: 8 }, { kind: 'drop', bars: 16 }, { kind: 'outro', bars: 8 },
  ],
  reggaeton: POP_FORM,
  house: [
    { kind: 'intro', bars: 8 }, { kind: 'build', bars: 8 }, { kind: 'drop', bars: 16 }, { kind: 'break', bars: 8 },
    { kind: 'drop', bars: 16 }, { kind: 'outro', bars: 8 },
  ],
}

/** Extra chord progressions per genre (scale degrees), so choruses can differ from verses. */
const PROGRESSIONS: Record<string, number[][]> = {
  'post-punk': [[1, 7, 6, 7], [6, 4, 1, 5], [1, 4, 6, 5], [1, 6, 4, 7]],
  metal: [[1, 6, 7, 1], [1, 2, 1, 7], [6, 7, 1, 1], [1, 1, 6, 2]],
  punk: [[1, 5, 6, 4], [1, 4, 1, 5], [6, 4, 1, 5], [4, 5, 1, 1]],
  'drum-and-bass': [[1, 1, 6, 7], [6, 7, 1, 1], [1, 4, 6, 5], [1, 6, 3, 7]],
  reggaeton: [[6, 4, 1, 5], [1, 7, 6, 7], [1, 5, 6, 4], [1, 6, 4, 5]],
}

const GENERIC_PROGRESSIONS = [[1, 6, 4, 5], [1, 4, 6, 5], [6, 4, 1, 5], [1, 5, 6, 4]]

export function progressionPool(genre: GenreDefinition): number[][] {
  return [genre.progression, ...(PROGRESSIONS[genre.id] ?? GENERIC_PROGRESSIONS)]
}

/** Note rhythms for the melody: `n` starts a note, `-` holds, `.` rests. */
const LEAD_RHYTHMS: Record<string, string[]> = {
  'post-punk': ['n---n---n-n-n---', 'n-----n-n---n---', 'n---n-n---n-n---'],
  metal: ['n.n.n.n.nnnnn---', 'n-n-n-nnn-n-n---', 'nnn.nnn.nnn.n---'],
  punk: ['n-n-n-n-n-n-n---', 'n---n-n-n---n---', 'n-n-n---n-n-n---'],
  'drum-and-bass': ['n-------n---n---', 'n-----------n---', 'n---n-------n---'],
  reggaeton: ['n..n..n.n..n..n.', 'n--n--n-n--n--n-', '...n..n....n..n.'],
}

const GENERIC_RHYTHMS = ['n---n---n-n-n---', 'n-n-n---n-n-n---']

export const BASS_VARIANTS = ['R-------R-------', 'R.R.R.R.R.R.R.R.', 'R..R..R.R..R..R.', 'R-5-R-5-R-5-8-5-', 'R.r.R.r.5.r.R.r.']
export const CHORD_VARIANTS = ['X---------------', 'X-x-X-x-X-x-X-x-', 'X..X..X.X..X..X.', 'X---X---X---X---', 'x.x.x.x.x.x.x.x.']

const TITLE_WORDS = {
  first: ['Bone', 'Static', 'Neon', 'Iron', 'Velvet', 'Black', 'Ghost', 'Rust', 'Cold', 'Hollow', 'Midnight', 'Concrete', 'Glass', 'Ashen'],
  second: ['Choir', 'Engine', 'Saints', 'Signal', 'Riot', 'Halo', 'Machine', 'Tide', 'Crown', 'Fever', 'Parade', 'Ritual', 'Wolves', 'Static'],
}

export function songTitle(random: Random): string {
  const first = pick(random, TITLE_WORDS.first)
  let second = pick(random, TITLE_WORDS.second)
  if (second === first) second = 'Ritual'
  return `${first} ${second}`
}

// ---------- Drum pattern helpers (all work on 16-character lines) ----------

const blank = '................'

function line(text: DrumPatternText, voice: DrumVoice): string {
  return text[voice] ?? blank
}

function setChar(value: string, step: number, char: string): string {
  return value.slice(0, step) + char + value.slice(step + 1)
}

function clean(text: DrumPatternText): DrumPatternText {
  const result: DrumPatternText = {}
  for (const voice of DRUM_VOICES) {
    const value = text[voice]
    if (value && /[Xxo]/.test(value)) result[voice] = value
  }
  return result
}

/** Keeps only the timekeeping (hats/ride) and a single kick, for intros and outros. */
export function thinDrums(text: DrumPatternText): DrumPatternText {
  return clean({
    kick: 'X...............',
    closedHat: text.closedHat,
    ride: text.ride,
    rim: text.rim,
  })
}

/** Half-time feel: snare only on beat 3, a sparse kick. */
export function halfTimeDrums(text: DrumPatternText): DrumPatternText {
  return clean({
    kick: 'X.........x.....',
    snare: '........X.......',
    closedHat: text.closedHat ?? 'x.x.x.x.x.x.x.x.',
    ride: text.ride,
  })
}

/** Double-time feel: a fast punk "skank" beat. */
export function doubleTimeDrums(text: DrumPatternText): DrumPatternText {
  return clean({
    kick: 'X.x.X.x.X.x.X.x.',
    snare: '..X...X...X...X.',
    closedHat: text.ride ? undefined : 'x.x.x.x.x.x.x.x.',
    ride: text.ride,
  })
}

/** More power: crash on the one, busier hats, a ghost note on the snare. */
export function pumpDrums(text: DrumPatternText): DrumPatternText {
  const next = { ...text }
  next.crash = setChar(line(next, 'crash'), 0, 'X')
  if (next.closedHat) next.closedHat = next.closedHat.replace(/\./g, (match, offset: number) => (offset % 2 === 1 ? 'o' : match))
  if (next.snare && next.snare[15] === '.') next.snare = setChar(next.snare, 15, 'o')
  return clean(next)
}

/** Less power: no crashes or ghost notes, hats back to 8ths. */
export function calmDrums(text: DrumPatternText): DrumPatternText {
  const next = { ...text }
  delete next.crash
  for (const voice of DRUM_VOICES) {
    const value = next[voice]
    if (value) next[voice] = value.replace(/o/g, '.')
  }
  if (next.closedHat) next.closedHat = next.closedHat.split('').map((char, step) => (step % 2 === 1 ? '.' : char)).join('')
  return clean(next)
}

/** Adds or removes a few non-backbone hits so a section feels new but stays in the style. */
export function varyDrums(text: DrumPatternText, random: Random, amount = 0.12): DrumPatternText {
  const next: DrumPatternText = {}
  for (const voice of DRUM_VOICES) {
    const value = text[voice]
    if (!value) continue
    next[voice] = value.split('').map((char, step) => {
      const backbone = (voice === 'kick' && step === 0) || (voice === 'snare' && char === 'X') || voice === 'crash'
      if (backbone || random() > amount) return char
      if (char !== '.') return voice === 'snare' ? 'o' : '.'
      return voice === 'kick' || voice === 'closedHat' ? (step % 2 === 0 ? 'x' : 'o') : char
    }).join('')
  }
  return clean(next)
}

const METAL_BREAKDOWN: DrumPatternText = { kick: 'X..X..X.X..X..X.', snare: '........X.......', crash: 'X.......x.......' }

export function drumsForSection(genre: GenreDefinition, kind: SectionKind, energy: Energy, random: Random): DrumPatternText {
  const { main, alt } = genre.drums
  let drums: DrumPatternText
  switch (kind) {
    case 'intro':
    case 'outro':
      drums = thinDrums(main)
      break
    case 'build':
      drums = clean({ ...main, kick: undefined, crash: undefined })
      break
    case 'chorus':
    case 'drop':
      drums = pumpDrums(genre.id === 'drum-and-bass' || genre.id === 'house' ? main : alt)
      break
    case 'bridge':
      drums = genre.id === 'punk' || genre.id === 'reggaeton' ? varyDrums(alt, random, 0.2) : halfTimeDrums(main)
      break
    case 'breakdown':
      drums = genre.id === 'metal' ? METAL_BREAKDOWN : halfTimeDrums(main)
      break
    case 'break':
      drums = thinDrums(main)
      break
    default:
      drums = varyDrums(main, random, 0.08)
  }
  if (energy === 1 && kind !== 'intro' && kind !== 'outro' && kind !== 'break') drums = calmDrums(drums)
  return clean(drums)
}

export function chordsForSection(genre: GenreDefinition, kind: SectionKind): string {
  if (kind === 'intro' || kind === 'break' || kind === 'outro') return genre.id === 'metal' || genre.id === 'punk' ? 'X-------X-------' : 'X---------------'
  if (kind === 'breakdown' && genre.id === 'metal') return 'X..X..X.X..X..X.'
  if (kind === 'bridge' && genre.id !== 'punk') return 'X-------X-------'
  return genre.chords
}

export function bassForSection(genre: GenreDefinition, kind: SectionKind): string {
  if (kind === 'breakdown' && genre.id === 'metal') return 'R..R..R.R..R..R.'
  if (kind === 'bridge' && genre.id !== 'punk') return 'R-------R-------'
  if (kind === 'outro') return 'R---------------'
  return genre.bass
}

const CHORD_TONES = [0, 2, 4, 7]
const PASSING = [1, 3, 5, 6]

/** A two-bar melody that follows the chords, in the genre's rhythm. */
export function generateLead(genre: GenreDefinition, random: Random): string {
  const rhythm = pick(random, LEAD_RHYTHMS[genre.id] ?? GENERIC_RHYTHMS)
  let current = pick(random, [0, 4, 7])
  const bar = (ending: boolean) => rhythm.split('').map((char, step) => {
    if (char !== 'n') return char
    const lastNote = rhythm.lastIndexOf('n') === step
    if (ending && lastNote) { current = 0; return '0' }
    const pool = random() < 0.75 ? CHORD_TONES : PASSING
    const near = pool.filter((note) => Math.abs(note - current) <= 3 && note !== current)
    current = near.length ? pick(random, near) : pick(random, pool)
    return String(current)
  }).join('')
  return bar(false) + bar(true)
}

const ENERGY_FOR: Record<SectionKind, Energy> = { intro: 1, verse: 2, build: 2, chorus: 3, drop: 3, bridge: 2, breakdown: 3, break: 1, outro: 1 }

let sectionCounter = 0
export function sectionId(): string {
  sectionCounter += 1
  return `s${Date.now().toString(36)}${sectionCounter.toString(36)}`
}

export interface SectionMaterial {
  verseProgression: number[]
  chorusProgression: number[]
  bridgeProgression: number[]
  verseLead: string
  chorusLead: string
}

export function songMaterial(genre: GenreDefinition, random: Random): SectionMaterial {
  const pool = progressionPool(genre)
  const verseProgression = [...genre.progression]
  const others = pool.slice(1)
  const chorusProgression = [...pick(random, others)]
  const bridgeOptions = others.filter((candidate) => candidate.join() !== chorusProgression.join())
  return {
    verseProgression,
    chorusProgression,
    bridgeProgression: [...pick(random, bridgeOptions.length ? bridgeOptions : others)],
    verseLead: generateLead(genre, random),
    chorusLead: generateLead(genre, random),
  }
}

export function buildSection(genre: GenreDefinition, kind: SectionKind, bars: number, material: SectionMaterial, random: Random): Section {
  const energy = ENERGY_FOR[kind]
  const loud = kind === 'chorus' || kind === 'drop'
  const progression = loud ? material.chorusProgression
    : kind === 'bridge' || kind === 'breakdown' || kind === 'break' ? material.bridgeProgression
      : material.verseProgression
  return {
    id: sectionId(),
    kind,
    bars,
    energy,
    progression: [...progression],
    drums: drumsForSection(genre, kind, energy, random),
    bass: bassForSection(genre, kind),
    chords: chordsForSection(genre, kind),
    lead: loud ? material.chorusLead : material.verseLead,
    parts: {
      drums: kind !== 'break',
      bass: kind !== 'intro' && kind !== 'break',
      chords: true,
      lead: loud || (kind === 'bridge' && genre.id !== 'metal'),
    },
    fill: bars >= 4 && kind !== 'outro',
  }
}

export interface GenerateOptions {
  seed?: number
  title?: string
  bpm?: number
  root?: number
  scale?: ScaleName
  structure?: StructureItem[]
}

export function generateSong(genreId: string, options: GenerateOptions = {}): SongSpec {
  const genre = getGenre(genreId)
  const seed = options.seed ?? newSeed()
  const random = seededRandom(seed)
  const material = songMaterial(genre, random)
  const structure = options.structure?.length ? options.structure : STRUCTURES[genre.id] ?? POP_FORM
  return {
    version: 1,
    title: options.title?.trim() || songTitle(random),
    genreId: genre.id,
    bpm: clampTempo(options.bpm ?? genre.bpm.default),
    swing: genre.swing,
    root: options.root ?? genre.key.root,
    scale: options.scale ?? genre.key.scale,
    sections: structure.map((item) => buildSection(genre, item.kind, item.bars, material, random)),
    sounds: { bass: genre.sounds.bass, chords: genre.sounds.chords, lead: genre.sounds.lead },
    kit: genre.sounds.kit,
    levels: { ...DEFAULT_LEVELS },
    seed: Math.floor(random() * 2 ** 31),
  }
}

export function clampTempo(bpm: number): number {
  return Math.max(60, Math.min(240, Math.round(bpm)))
}

export const PRIMARY_GENRES = GENRES.filter((genre) => genre.primary).map((genre) => genre.id)
