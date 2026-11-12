import type { MixPart, SynthPart } from '../beatmaker/engine/types'
import { allPatches, getGenre, GENRES, type DrumPatternText } from '../beatmaker/genres'
import { NOTE_NAMES, SCALE_LABELS, SCALES, type ScaleName } from '../beatmaker/theory'
import { SYNTH_TWEAKS, tweakPatch, type SynthTweak } from '../beatmaker/tweak'
import {
  BASS_VARIANTS, buildSection, CHORD_VARIANTS, clampTempo, calmDrums, doubleTimeDrums, drumsForSection, generateLead, generateSong,
  halfTimeDrums, progressionPool, pumpDrums, sectionId, songMaterial, varyDrums, type StructureItem,
} from './generate'
import { nextSeed, pick, seededRandom, type Random } from './random'
import {
  MAX_BARS, MAX_SECTIONS, SECTION_KINDS, SECTION_LABELS, sectionName, sectionProblems, SONG_PARTS,
  type Energy, type Section, type SectionKind, type SectionParts, type SongSpec,
} from './spec'

/**
 * Every change Fret (offline or live) can make to a song. The live AI's tools map one to one
 * onto these, and the "Under the hood" drawer uses them too, so there is one way to change a song.
 *
 * Targets: `section` is a 1-based position in the song; `kind` means every section of that kind
 * ("the chorus" = all choruses). With neither, the edit applies to the whole song.
 */
export interface Target {
  section?: number
  kind?: SectionKind
}

export type RegenerateWhat = 'drums' | 'bass' | 'chords' | 'lead' | 'progression' | 'all'

export type SongEdit =
  | { type: 'new_song'; genre: string; bpm?: number; root?: number; scale?: ScaleName; title?: string; structure?: StructureItem[] }
  | { type: 'change_genre'; genre: string }
  | { type: 'set_tempo'; bpm?: number; delta?: number }
  | { type: 'set_key'; root?: number; scale?: ScaleName }
  | { type: 'set_title'; title: string }
  | ({ type: 'regenerate'; what: RegenerateWhat } & Target)
  | ({ type: 'energy'; direction: 'up' | 'down' } & Target)
  | ({ type: 'feel'; feel: 'half' | 'normal' | 'double' } & Target)
  | { type: 'tone'; tweak: SynthTweak; part?: SynthPart | 'all' }
  | ({ type: 'parts'; part: keyof SectionParts; on: boolean } & Target)
  | { type: 'add_section'; kind: SectionKind; bars?: number; position?: number; copy?: number }
  | { type: 'remove_section'; section: number }
  | { type: 'move_section'; section: number; to: number }
  | ({ type: 'set_bars'; bars: number } & Target)
  | ({ type: 'set_fill'; on: boolean } & Target)
  | ({ type: 'set_progression'; progression: number[] } & Target)
  | ({ type: 'set_drums'; drums: DrumPatternText } & Target)
  | ({ type: 'set_bass'; pattern: string } & Target)
  | ({ type: 'set_chords'; pattern: string } & Target)
  | ({ type: 'set_lead'; pattern: string } & Target)
  | { type: 'set_sound'; part: SynthPart; preset: string }
  | { type: 'set_level'; part: MixPart; level: number }

export type EditType = SongEdit['type']

export class EditError extends Error {}

export interface EditResult {
  song: SongSpec
  /** One short past-tense line, e.g. "made the chorus heavier". */
  summary: string
}

const SYNTH_PARTS: SynthPart[] = ['bass', 'chords', 'lead']
const MIX_PARTS: MixPart[] = ['drums', 'bass', 'chords', 'lead']

function fail(message: string): never {
  throw new EditError(message)
}

function genreIdFrom(value: unknown): string {
  if (typeof value !== 'string') fail('genre must be text')
  const wanted = value.toLowerCase().replace(/[^a-z]/g, '')
  const genre = GENRES.find((candidate) => candidate.id.replace(/[^a-z]/g, '') === wanted || candidate.name.toLowerCase().replace(/[^a-z]/g, '') === wanted)
  if (!genre) fail(`unknown genre "${value}" (try ${GENRES.map((candidate) => candidate.id).join(', ')})`)
  return genre.id
}

/** Which sections an edit touches, as indexes. Fails if the target matches nothing. */
export function resolveTarget(song: SongSpec, target: Target): number[] {
  if (target.section !== undefined) {
    if (!Number.isInteger(target.section) || target.section < 1 || target.section > song.sections.length) fail(`there is no section ${target.section}; the song has ${song.sections.length}`)
    return [target.section - 1]
  }
  if (target.kind !== undefined) {
    if (!SECTION_KINDS.includes(target.kind)) fail(`unknown section kind "${target.kind}"`)
    const indexes = song.sections.flatMap((section, index) => (section.kind === target.kind ? [index] : []))
    if (!indexes.length) fail(`the song has no ${SECTION_LABELS[target.kind].toLowerCase()}`)
    return indexes
  }
  return song.sections.map((_, index) => index)
}

function targetName(song: SongSpec, target: Target): string {
  if (target.section !== undefined) return sectionName(song, target.section - 1).toLowerCase()
  if (target.kind !== undefined) {
    const count = song.sections.filter((section) => section.kind === target.kind).length
    const label = SECTION_LABELS[target.kind].toLowerCase()
    return count > 1 ? `every ${label}` : `the ${label}`
  }
  return 'the whole song'
}

function mapSections(song: SongSpec, target: Target, change: (section: Section, index: number) => Section): SongSpec {
  const indexes = new Set(resolveTarget(song, target))
  const sections = song.sections.map((section, index) => {
    if (!indexes.has(index)) return section
    const next = change(section, index)
    const problems = sectionProblems(next)
    if (problems.length) fail(problems.join('; '))
    return next
  })
  return { ...song, sections }
}

function withSeed(song: SongSpec): { song: SongSpec; random: Random } {
  return { song: { ...song, seed: nextSeed(song.seed) }, random: seededRandom(song.seed) }
}

function clampEnergy(value: number): Energy {
  return Math.max(1, Math.min(3, Math.round(value))) as Energy
}

const FEEL_TEXT = { half: 'half-time', double: 'double-time', normal: 'back to the normal groove' } as const

/** Applies one edit and says what changed. Throws EditError with a plain-word reason if it can't. */
export function applyEdit(song: SongSpec, edit: SongEdit): EditResult {
  const genre = getGenre(song.genreId)
  switch (edit.type) {
    case 'new_song': {
      const genreId = genreIdFrom(edit.genre)
      if (edit.scale !== undefined && !(edit.scale in SCALES)) fail(`unknown scale "${edit.scale}"`)
      if (edit.root !== undefined && (!Number.isInteger(edit.root) || edit.root < 0 || edit.root > 11)) fail('root must be 0–11 (0 = C)')
      const structure = edit.structure?.filter((item) => SECTION_KINDS.includes(item.kind)).map((item) => ({ kind: item.kind, bars: Math.max(1, Math.min(MAX_BARS, Math.round(item.bars))) })).slice(0, MAX_SECTIONS)
      const next = generateSong(genreId, { seed: nextSeed(song.seed), title: edit.title, bpm: edit.bpm, root: edit.root, scale: edit.scale, structure })
      return { song: next, summary: `wrote a new ${getGenre(genreId).name} song, "${next.title}"` }
    }
    case 'change_genre': {
      const genreId = genreIdFrom(edit.genre)
      const target = getGenre(genreId)
      const { random } = withSeed(song)
      const material = songMaterial(target, random)
      const sections = song.sections.map((section) => ({ ...buildSection(target, section.kind, section.bars, material, random), id: section.id }))
      return {
        song: { ...song, genreId, bpm: target.bpm.default, swing: target.swing, root: target.key.root, scale: target.key.scale, sections, sounds: { bass: target.sounds.bass, chords: target.sounds.chords, lead: target.sounds.lead }, kit: target.sounds.kit, seed: nextSeed(song.seed) },
        summary: `turned it into ${target.name}, same song shape`,
      }
    }
    case 'set_tempo': {
      if (edit.bpm === undefined && edit.delta === undefined) fail('give a bpm or a delta')
      const bpm = clampTempo(edit.bpm ?? song.bpm + (edit.delta ?? 0))
      return { song: { ...song, bpm }, summary: `set the tempo to ${bpm} BPM` }
    }
    case 'set_key': {
      if (edit.scale !== undefined && !(edit.scale in SCALES)) fail(`unknown scale "${edit.scale}" (try ${Object.keys(SCALES).join(', ')})`)
      if (edit.root !== undefined && (!Number.isInteger(edit.root) || edit.root < 0 || edit.root > 11)) fail('root must be 0–11 (0 = C)')
      const next = { ...song, root: edit.root ?? song.root, scale: edit.scale ?? song.scale }
      return { song: next, summary: `moved it to ${NOTE_NAMES[next.root]} ${SCALE_LABELS[next.scale].toLowerCase()}` }
    }
    case 'set_title': {
      const title = String(edit.title ?? '').trim().slice(0, 60)
      if (!title) fail('the title is empty')
      return { song: { ...song, title }, summary: `renamed it "${title}"` }
    }
    case 'regenerate': {
      const { song: seeded, random } = withSeed(song)
      const pool = progressionPool(genre)
      const what = edit.what
      if (!['drums', 'bass', 'chords', 'lead', 'progression', 'all'].includes(what)) fail(`can't regenerate "${what}"`)
      const lead = generateLead(genre, random)
      const next = mapSections(seeded, edit, (section) => {
        const changed = { ...section }
        if (what === 'drums' || what === 'all') changed.drums = varyDrums(drumsForSection(genre, section.kind, section.energy, random), random, 0.22)
        if (what === 'bass' || what === 'all') changed.bass = pick(random, BASS_VARIANTS.filter((pattern) => pattern !== section.bass))
        if (what === 'chords' || what === 'all') changed.chords = pick(random, CHORD_VARIANTS.filter((pattern) => pattern !== section.chords))
        if (what === 'lead' || what === 'all') changed.lead = lead
        if (what === 'progression' || what === 'all') changed.progression = [...pick(random, pool.filter((option) => option.join() !== section.progression.join()))]
        return changed
      })
      const words: Record<RegenerateWhat, string> = { drums: 'new drums', bass: 'a new bass line', chords: 'a new chord rhythm', lead: 'a new melody', progression: 'new chords', all: 'a fresh take' }
      return { song: next, summary: `wrote ${words[what]} for ${targetName(song, edit)}` }
    }
    case 'energy': {
      const up = edit.direction === 'up'
      const next = mapSections(song, edit, (section) => ({
        ...section,
        energy: clampEnergy(section.energy + (up ? 1 : -1)),
        drums: up ? pumpDrums(section.drums) : calmDrums(section.drums),
        parts: up ? { ...section.parts, drums: true, bass: true } : section.energy <= 2 ? { ...section.parts, lead: false } : section.parts,
      }))
      return { song: next, summary: `${up ? 'pushed' : 'pulled back'} the energy in ${targetName(song, edit)}` }
    }
    case 'feel': {
      if (!['half', 'normal', 'double'].includes(edit.feel)) fail(`unknown feel "${edit.feel}"`)
      const { song: seeded, random } = withSeed(song)
      const next = mapSections(seeded, edit, (section) => ({
        ...section,
        drums: edit.feel === 'half' ? halfTimeDrums(genre.drums.main) : edit.feel === 'double' ? doubleTimeDrums(genre.drums.main) : drumsForSection(genre, section.kind, section.energy, random),
      }))
      return { song: next, summary: `${edit.feel === 'normal' ? 'put' : 'made'} ${targetName(song, edit)} ${FEEL_TEXT[edit.feel]}` }
    }
    case 'tone': {
      if (!SYNTH_TWEAKS.includes(edit.tweak)) fail(`unknown sound change "${edit.tweak}"`)
      const parts = !edit.part || edit.part === 'all' ? SYNTH_PARTS : [edit.part]
      if (!parts.every((part) => SYNTH_PARTS.includes(part))) fail(`unknown part "${edit.part}"`)
      const sounds = { ...song.sounds }
      for (const part of parts) sounds[part] = tweakPatch(sounds[part], edit.tweak)
      const kit = edit.tweak === 'heavier' ? { ...song.kit, drive: Math.min(1, song.kit.drive + 0.15) } : song.kit
      return { song: { ...song, sounds, kit }, summary: `made the ${parts.length === 3 ? 'sound' : parts[0]} ${edit.tweak}` }
    }
    case 'parts': {
      if (!SONG_PARTS.includes(edit.part)) fail(`unknown part "${edit.part}"`)
      const next = mapSections(song, edit, (section) => ({ ...section, parts: { ...section.parts, [edit.part]: Boolean(edit.on) } }))
      return { song: next, summary: `${edit.on ? 'brought in' : 'muted'} the ${edit.part === 'lead' ? 'melody' : edit.part} in ${targetName(song, edit)}` }
    }
    case 'add_section': {
      if (!SECTION_KINDS.includes(edit.kind)) fail(`unknown section kind "${edit.kind}"`)
      if (song.sections.length >= MAX_SECTIONS) fail(`a song can have at most ${MAX_SECTIONS} sections`)
      const { song: seeded, random } = withSeed(song)
      let section: Section
      if (edit.copy !== undefined) {
        resolveTarget(song, { section: edit.copy })
        section = { ...song.sections[edit.copy - 1], id: sectionId() }
      } else {
        const sameKind = [...song.sections].reverse().find((candidate) => candidate.kind === edit.kind)
        section = sameKind ? { ...sameKind, id: sectionId() } : buildSection(genre, edit.kind, 8, songMaterial(genre, random), random)
      }
      if (edit.bars !== undefined) section = { ...section, bars: Math.max(1, Math.min(MAX_BARS, Math.round(edit.bars))) }
      const outro = song.sections.findIndex((candidate) => candidate.kind === 'outro')
      const defaultIndex = edit.kind === 'outro' || outro < 0 ? song.sections.length : outro
      const index = edit.position !== undefined ? Math.max(0, Math.min(song.sections.length, Math.round(edit.position) - 1)) : defaultIndex
      const sections = [...song.sections]
      sections.splice(index, 0, section)
      return { song: { ...seeded, sections }, summary: `added a ${SECTION_LABELS[edit.kind].toLowerCase()} at position ${index + 1}` }
    }
    case 'remove_section': {
      const [index] = resolveTarget(song, { section: edit.section })
      if (song.sections.length === 1) fail("that's the only section left")
      const name = sectionName(song, index).toLowerCase()
      return { song: { ...song, sections: song.sections.filter((_, other) => other !== index) }, summary: `cut ${name}` }
    }
    case 'move_section': {
      const [from] = resolveTarget(song, { section: edit.section })
      const to = Math.max(0, Math.min(song.sections.length - 1, Math.round(edit.to) - 1))
      const sections = [...song.sections]
      const [moved] = sections.splice(from, 1)
      sections.splice(to, 0, moved)
      return { song: { ...song, sections }, summary: `moved ${sectionName(song, from).toLowerCase()} to position ${to + 1}` }
    }
    case 'set_bars': {
      const bars = Math.round(edit.bars)
      if (!(bars >= 1 && bars <= MAX_BARS)) fail(`bars must be 1–${MAX_BARS}`)
      return { song: mapSections(song, edit, (section) => ({ ...section, bars })), summary: `made ${targetName(song, edit)} ${bars} bars long` }
    }
    case 'set_fill':
      return { song: mapSections(song, edit, (section) => ({ ...section, fill: Boolean(edit.on) })), summary: `${edit.on ? 'added a drum fill at the end of' : 'took the fill out of'} ${targetName(song, edit)}` }
    case 'set_progression': {
      if (!Array.isArray(edit.progression) || edit.progression.length < 1 || edit.progression.length > 8) fail('a progression is 1–8 scale degrees')
      return { song: mapSections(song, edit, (section) => ({ ...section, progression: edit.progression.map(Number) })), summary: `set the chords in ${targetName(song, edit)} to ${edit.progression.join('-')}` }
    }
    case 'set_drums': {
      if (!edit.drums || typeof edit.drums !== 'object') fail('drums must be an object of 16-character lines')
      return { song: mapSections(song, edit, (section) => ({ ...section, drums: { ...edit.drums } })), summary: `rewrote the drums in ${targetName(song, edit)}` }
    }
    case 'set_bass':
      return { song: mapSections(song, edit, (section) => ({ ...section, bass: String(edit.pattern) })), summary: `rewrote the bass line in ${targetName(song, edit)}` }
    case 'set_chords':
      return { song: mapSections(song, edit, (section) => ({ ...section, chords: String(edit.pattern) })), summary: `changed the chord rhythm in ${targetName(song, edit)}` }
    case 'set_lead':
      return { song: mapSections(song, edit, (section) => ({ ...section, lead: String(edit.pattern), parts: { ...section.parts, lead: true } })), summary: `wrote a melody for ${targetName(song, edit)}` }
    case 'set_sound': {
      if (!SYNTH_PARTS.includes(edit.part)) fail(`unknown part "${edit.part}"`)
      const wanted = String(edit.preset).toLowerCase()
      const preset = allPatches().find((patch) => patch.name.toLowerCase() === wanted) ?? allPatches().find((patch) => patch.name.toLowerCase().includes(wanted))
      if (!preset) fail(`no sound called "${edit.preset}"`)
      return { song: { ...song, sounds: { ...song.sounds, [edit.part]: preset } }, summary: `switched the ${edit.part} to "${preset.name}"` }
    }
    case 'set_level': {
      if (!MIX_PARTS.includes(edit.part)) fail(`unknown part "${edit.part}"`)
      const level = Math.max(0, Math.min(1, Number(edit.level)))
      if (Number.isNaN(level)) fail('level must be 0–1')
      return { song: { ...song, levels: { ...song.levels, [edit.part]: level } }, summary: `set the ${edit.part} volume to ${Math.round(level * 100)}%` }
    }
    default:
      return fail(`unknown change "${(edit as { type?: string }).type}"`)
  }
}

export interface EditsOutcome {
  song: SongSpec
  summaries: string[]
  errors: string[]
}

/** Applies edits in order; an edit that fails is skipped and reported, the rest still apply. */
export function applyEdits(song: SongSpec, edits: SongEdit[]): EditsOutcome {
  let current = song
  const summaries: string[] = []
  const errors: string[] = []
  for (const edit of edits) {
    try {
      const result = applyEdit(current, edit)
      current = result.song
      summaries.push(result.summary)
    } catch (error) {
      if (!(error instanceof EditError)) throw error
      errors.push(error.message)
    }
  }
  return { song: current, summaries, errors }
}

/** The songs Fret starts from when there is nothing yet: an empty placeholder for edits to replace. */
export function emptySong(): SongSpec {
  return generateSong('post-punk', { seed: 1, title: 'Untitled' })
}
