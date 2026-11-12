import { DRUM_VOICES, GENRES } from '../beatmaker/genres'
import { SCALES } from '../beatmaker/theory'
import { SYNTH_TWEAKS } from '../beatmaker/tweak'
import type { SongEdit } from './edit'
import { instrumentNames, KIT_RANGES, PATCH_RANGES, SOUND_PARTS, soundWords } from './sound'
import { STYLES } from './styles'
import { SECTION_KINDS, type SongSpec } from './spec'

/**
 * The live AI's toolbox: one tool per song edit, so Claude changes the song through exactly the
 * same rules as the offline brain and the drawer. Plain JSON Schema, no SDK types, so the
 * client tests can check them too.
 */

export interface ToolDefinition {
  name: SongEdit['type']
  description: string
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

const kind = { type: 'string', enum: [...SECTION_KINDS], description: 'Every section of this kind (e.g. "chorus" = all choruses).' }
const section = { type: 'integer', minimum: 1, description: '1-based position of one section in the song.' }
const target = { section, kind }
const part16 = (what: string) => ({ type: 'string', minLength: 16, maxLength: 16, description: what })

const describeHint = `Plain words, e.g. "fuzzy wide guitars", "deep gliding 808", "glassy bells, echoey". Instruments: ${instrumentNames().join(', ')}. Describing words: ${soundWords().join(', ')}.`
const sounds = {
  type: 'object',
  description: `How each part should sound. ${describeHint}`,
  properties: Object.fromEntries(SOUND_PARTS.map((part) => [part, { type: 'string', maxLength: 200 }])),
  additionalProperties: false,
}
const style = { type: 'string', maxLength: 40, description: `A style name. Known styles bring their own tempo, mood, feel and sounds: ${STYLES.map((item) => item.id).join(', ')}. Any other name is kept as a label; then also give genre (the closest engine) and sounds.` }
const genre = { type: 'string', enum: GENRES.map((item) => item.id), description: 'The song engine: its grooves and song shapes. Optional when style is a known style.' }

export const SONG_TOOLS: ToolDefinition[] = [
  {
    name: 'new_song',
    description: 'Write a brand-new song, replacing the current one. Use for "make me a ... song". Any genre works: use a known style, or the closest engine plus a style label and sound descriptions. Leave structure out to use the usual song shape.',
    input_schema: {
      type: 'object',
      properties: {
        genre,
        style,
        sounds,
        bpm: { type: 'integer', minimum: 60, maximum: 240 },
        root: { type: 'integer', minimum: 0, maximum: 11, description: 'Key root, 0 = C, 4 = E, 9 = A.' },
        scale: { type: 'string', enum: Object.keys(SCALES) },
        title: { type: 'string' },
        structure: { type: 'array', maxItems: 16, items: { type: 'object', properties: { kind, bars: { type: 'integer', minimum: 1, maximum: 32 } }, required: ['kind', 'bars'] } },
      },
    },
  },
  { name: 'change_genre', description: 'Rewrite the current song in another genre or style, keeping its section layout.', input_schema: { type: 'object', properties: { genre, style, sounds } } },
  { name: 'set_tempo', description: 'Set the tempo (bpm) or nudge it (delta, e.g. +10).', input_schema: { type: 'object', properties: { bpm: { type: 'integer', minimum: 60, maximum: 240 }, delta: { type: 'integer' } } } },
  { name: 'set_key', description: 'Change key root and/or scale (mood). minor = dark, phrygian = evil/heavy, major = bright, dorian = moody.', input_schema: { type: 'object', properties: { root: { type: 'integer', minimum: 0, maximum: 11 }, scale: { type: 'string', enum: Object.keys(SCALES) } } } },
  { name: 'set_title', description: 'Rename the song.', input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  { name: 'regenerate', description: 'Write a fresh version of one layer (or everything) for the target sections.', input_schema: { type: 'object', properties: { what: { type: 'string', enum: ['drums', 'bass', 'chords', 'lead', 'progression', 'all'], description: 'chords = chord rhythm, progression = which chords.' }, ...target }, required: ['what'] } },
  { name: 'energy', description: 'Make target sections hit harder (up) or calmer (down).', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] }, ...target }, required: ['direction'] } },
  { name: 'feel', description: 'Change the drum feel: half-time (heavy, slow), double-time (fast punk beat) or normal.', input_schema: { type: 'object', properties: { feel: { type: 'string', enum: ['half', 'normal', 'double'] }, ...target }, required: ['feel'] } },
  { name: 'tone', description: 'Change how an instrument sounds.', input_schema: { type: 'object', properties: { tweak: { type: 'string', enum: SYNTH_TWEAKS }, part: { type: 'string', enum: ['bass', 'chords', 'lead', 'all'] } }, required: ['tweak'] } },
  { name: 'parts', description: 'Turn an instrument on or off in target sections (lead = the melody).', input_schema: { type: 'object', properties: { part: { type: 'string', enum: ['drums', 'bass', 'chords', 'lead'] }, on: { type: 'boolean' }, ...target }, required: ['part', 'on'] } },
  { name: 'add_section', description: 'Add a section. By default it copies the last section of that kind and goes before the outro.', input_schema: { type: 'object', properties: { kind, bars: { type: 'integer', minimum: 1, maximum: 32 }, position: { type: 'integer', minimum: 1, description: '1-based position to insert at.' }, copy: { type: 'integer', minimum: 1, description: 'Copy this section number instead.' } }, required: ['kind'] } },
  { name: 'remove_section', description: 'Remove one section by its position.', input_schema: { type: 'object', properties: { section }, required: ['section'] } },
  { name: 'move_section', description: 'Move a section to a new position.', input_schema: { type: 'object', properties: { section, to: { type: 'integer', minimum: 1 } }, required: ['section', 'to'] } },
  { name: 'set_bars', description: 'Set how many bars target sections last (1–32).', input_schema: { type: 'object', properties: { bars: { type: 'integer', minimum: 1, maximum: 32 }, ...target }, required: ['bars'] } },
  { name: 'set_fill', description: 'Turn the drum fill at the end of target sections on or off.', input_schema: { type: 'object', properties: { on: { type: 'boolean' }, ...target }, required: ['on'] } },
  { name: 'set_progression', description: 'Set the chords as scale degrees 1–7, one per bar, repeating (e.g. [1, 6, 3, 7]).', input_schema: { type: 'object', properties: { progression: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, minItems: 1, maxItems: 8 }, ...target }, required: ['progression'] } },
  {
    name: 'set_drums',
    description: 'Write the drum pattern for target sections. One 16-character line per drum, one character per 16th note: X accent, x hit, o ghost, . rest. Omit drums that don\'t play.',
    input_schema: { type: 'object', properties: { drums: { type: 'object', properties: Object.fromEntries(DRUM_VOICES.map((voice) => [voice, part16(voice)])), additionalProperties: false }, ...target }, required: ['drums'] },
  },
  { name: 'set_bass', description: 'Bass rhythm for target sections, 16 characters relative to the chord: R root accent, r soft root, 3 third, 5 fifth, 7 seventh, 8 octave, - hold, . rest.', input_schema: { type: 'object', properties: { pattern: part16('bass pattern'), ...target }, required: ['pattern'] } },
  { name: 'set_chords', description: 'Chord rhythm for target sections, 16 characters: X accent, x hit, m palm-muted chug, - hold, . rest.', input_schema: { type: 'object', properties: { pattern: part16('chord rhythm'), ...target }, required: ['pattern'] } },
  { name: 'set_lead', description: 'Melody for target sections, 16/32/48/64 characters that repeat. Digits 0–9 are scale steps above the current chord root (0 root, 2 third, 4 fifth, 7 octave), - holds, . rests. Also turns the melody on.', input_schema: { type: 'object', properties: { pattern: { type: 'string', minLength: 16, maxLength: 64 }, ...target }, required: ['pattern'] } },
  { name: 'set_sound', description: 'Switch an instrument to a named preset sound.', input_schema: { type: 'object', properties: { part: { type: 'string', enum: ['bass', 'chords', 'lead'] }, preset: { type: 'string' } }, required: ['part', 'preset'] } },
  {
    name: 'design_sound',
    description: `Change how one part sounds, from a description and/or exact settings. Use for any request about instruments or tone ("make the bass an 808", "guitars fuzzier and wider", "roomy drums"). ${describeHint}`,
    input_schema: {
      type: 'object',
      properties: {
        part: { type: 'string', enum: SOUND_PARTS },
        description: { type: 'string', maxLength: 200 },
        settings: {
          type: 'object',
          description: 'Optional exact numbers, applied after the description. Synth parts: wave (sine, triangle, sawtooth, square, fatsawtooth, fatsquare, fattriangle) and these ranges; drums: the kit ranges.',
          properties: {
            wave: { type: 'string', enum: ['sine', 'triangle', 'sawtooth', 'square', 'fatsawtooth', 'fatsquare', 'fattriangle'] },
            ...Object.fromEntries(Object.entries({ ...PATCH_RANGES, ...KIT_RANGES }).map(([key, [minimum, maximum]]) => [key, { type: 'number', minimum, maximum }])),
          },
          additionalProperties: false,
        },
      },
      required: ['part'],
    },
  },
  { name: 'set_level', description: 'Set an instrument\'s volume, 0–1.', input_schema: { type: 'object', properties: { part: { type: 'string', enum: ['drums', 'bass', 'chords', 'lead'] }, level: { type: 'number', minimum: 0, maximum: 1 } }, required: ['part', 'level'] } },
]

const TOOL_NAMES = new Set<string>(SONG_TOOLS.map((tool) => tool.name))

/** Turns a tool call into an edit. Values are checked again by `applyEdit`. */
export function editFromToolCall(name: string, input: unknown): SongEdit | undefined {
  if (!TOOL_NAMES.has(name) || !input || typeof input !== 'object' || Array.isArray(input)) return undefined
  return { ...(input as Record<string, unknown>), type: name } as SongEdit
}

/** A compact copy of the song for the model to read (drops sound-design numbers it doesn't need). */
export function songForModel(song: SongSpec | undefined) {
  if (!song) return null
  return {
    title: song.title,
    genre: song.genreId,
    style: song.style,
    bpm: song.bpm,
    root: song.root,
    scale: song.scale,
    sounds: { bass: song.sounds.bass.name, chords: song.sounds.chords.name, lead: song.sounds.lead.name, drums: song.kit },
    sections: song.sections.map((section, index) => ({
      position: index + 1,
      kind: section.kind,
      bars: section.bars,
      energy: section.energy,
      progression: section.progression,
      parts: section.parts,
      fill: section.fill,
      drums: section.drums,
      bass: section.bass,
      chords: section.chords,
      lead: section.lead,
    })),
  }
}
