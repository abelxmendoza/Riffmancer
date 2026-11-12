import type { SynthPart } from '../beatmaker/engine/types'

/**
 * Recorded instruments (real bass, guitars, keys, strings, horns...) from the FluidR3 General MIDI
 * soundfont (MIT). Thirty are shipped with the app in public/instruments; any other General MIDI
 * instrument loads from the gleitz midi-js-soundfonts site on demand. Pure data and helpers.
 */

export interface RealInstrument {
  id: string
  name: string
  group: 'Bass' | 'Guitars' | 'Keys' | 'Strings' | 'Brass & winds' | 'Mallets & world' | 'Voices' | 'Other'
  /** Shipped with the app (works offline and never depends on another site). */
  local: boolean
  /** Level correction in dB so every instrument sits at about the same loudness. */
  gain: number
  /** Parts it suits, best first. */
  parts: SynthPart[]
  /** Sustaining instruments (organ, strings) fade slowly; plucked ones ring out on their own. */
  release: number
}

const LOCAL: [string, string, RealInstrument['group'], number, SynthPart[], number][] = [
  ['electric_bass_finger', 'Bass guitar (fingers)', 'Bass', -27, ['bass'], 0.15],
  ['electric_bass_pick', 'Bass guitar (pick)', 'Bass', -28, ['bass'], 0.12],
  ['slap_bass_1', 'Slap bass', 'Bass', -34, ['bass'], 0.12],
  ['fretless_bass', 'Fretless bass', 'Bass', -25, ['bass'], 0.2],
  ['acoustic_bass', 'Upright bass', 'Bass', -30, ['bass'], 0.25],
  ['distortion_guitar', 'Distorted guitar', 'Guitars', -24.5, ['chords', 'lead'], 0.2],
  ['overdriven_guitar', 'Overdriven guitar', 'Guitars', -27, ['chords', 'lead'], 0.2],
  ['electric_guitar_clean', 'Clean electric guitar', 'Guitars', -29, ['chords', 'lead'], 0.4],
  ['electric_guitar_muted', 'Palm-muted guitar', 'Guitars', -35, ['chords', 'lead'], 0.1],
  ['acoustic_guitar_steel', 'Acoustic guitar', 'Guitars', -30.5, ['chords', 'lead'], 0.6],
  ['acoustic_guitar_nylon', 'Nylon guitar', 'Guitars', -29, ['chords', 'lead'], 0.6],
  ['acoustic_grand_piano', 'Grand piano', 'Keys', -33.5, ['chords', 'lead'], 0.8],
  ['electric_piano_1', 'Electric piano', 'Keys', -28, ['chords', 'lead'], 0.7],
  ['rock_organ', 'Rock organ', 'Keys', -25.5, ['chords', 'lead'], 0.15],
  ['drawbar_organ', 'Drawbar organ', 'Keys', -29, ['chords'], 0.15],
  ['string_ensemble_1', 'String section', 'Strings', -31, ['chords'], 1],
  ['synth_strings_1', 'Synth strings', 'Strings', -28, ['chords'], 1],
  ['violin', 'Violin', 'Strings', -27.5, ['lead'], 0.5],
  ['cello', 'Cello', 'Strings', -28, ['lead', 'bass'], 0.5],
  ['pizzicato_strings', 'Pizzicato strings', 'Strings', -30, ['lead', 'chords'], 0.3],
  ['brass_section', 'Brass section', 'Brass & winds', -29, ['chords', 'lead'], 0.3],
  ['trumpet', 'Trumpet', 'Brass & winds', -31, ['lead'], 0.25],
  ['alto_sax', 'Saxophone', 'Brass & winds', -25, ['lead'], 0.25],
  ['flute', 'Flute', 'Brass & winds', -28, ['lead'], 0.3],
  ['choir_aahs', 'Choir', 'Voices', -30, ['chords'], 1],
  ['marimba', 'Marimba', 'Mallets & world', -32, ['lead', 'chords'], 0.5],
  ['vibraphone', 'Vibraphone', 'Mallets & world', -33, ['lead', 'chords'], 0.8],
  ['music_box', 'Music box', 'Mallets & world', -33.5, ['lead'], 0.8],
  ['steel_drums', 'Steel drums', 'Mallets & world', -31.5, ['lead'], 0.5],
  ['sitar', 'Sitar', 'Mallets & world', -34.5, ['lead'], 0.6],
]

/** Every General MIDI instrument in the FluidR3 set, by id. */
export const GM_IDS = [
  'accordion', 'acoustic_bass', 'acoustic_grand_piano', 'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'agogo', 'alto_sax', 'applause', 'bagpipe', 'banjo', 'baritone_sax', 'bassoon', 'bird_tweet', 'blown_bottle', 'brass_section', 'breath_noise', 'bright_acoustic_piano', 'celesta', 'cello', 'choir_aahs', 'church_organ', 'clarinet', 'clavinet', 'contrabass', 'distortion_guitar', 'drawbar_organ', 'dulcimer', 'electric_bass_finger', 'electric_bass_pick', 'electric_grand_piano', 'electric_guitar_clean', 'electric_guitar_jazz', 'electric_guitar_muted', 'electric_piano_1', 'electric_piano_2', 'english_horn', 'fiddle', 'flute', 'french_horn', 'fretless_bass', 'fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere', 'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi', 'glockenspiel', 'guitar_fret_noise', 'guitar_harmonics', 'gunshot', 'harmonica', 'harpsichord', 'helicopter', 'honkytonk_piano', 'kalimba', 'koto', 'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff', 'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead', 'marimba', 'melodic_tom', 'music_box', 'muted_trumpet', 'oboe', 'ocarina', 'orchestra_hit', 'orchestral_harp', 'overdriven_guitar', 'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir', 'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep', 'pan_flute', 'percussive_organ', 'piccolo', 'pizzicato_strings', 'recorder', 'reed_organ', 'reverse_cymbal', 'rock_organ', 'seashore', 'shakuhachi', 'shamisen', 'shanai', 'sitar', 'slap_bass_1', 'slap_bass_2', 'soprano_sax', 'steel_drums', 'string_ensemble_1', 'string_ensemble_2', 'synth_bass_1', 'synth_bass_2', 'synth_brass_1', 'synth_brass_2', 'synth_choir', 'synth_drum', 'synth_strings_1', 'synth_strings_2', 'taiko_drum', 'tango_accordion', 'telephone_ring', 'tenor_sax', 'timpani', 'tinkle_bell', 'tremolo_strings', 'trombone', 'trumpet', 'tuba', 'tubular_bells', 'vibraphone', 'viola', 'violin', 'voice_oohs', 'whistle', 'woodblock', 'xylophone',
] as const

const humanize = (id: string) => {
  const text = id.replace(/__/g, ' ').replace(/_/g, ' ').replace(/\b(\d)\b/, '$1').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const BASSY = /bass|tuba|contrabass|bassoon|baritone/
const SUSTAINED = /organ|string|choir|pad|voice|oohs|accordion|harmonica|bagpipe|sax|horn|trumpet|trombone|tuba|clarinet|oboe|flute|bassoon|whistle|recorder|ocarina/

export const INSTRUMENT_LIBRARY: RealInstrument[] = [
  ...LOCAL.map(([id, name, group, level, parts, release]) => ({ id, name, group, local: true, gain: -28 - level, parts, release })),
  ...GM_IDS.filter((id) => !LOCAL.some(([local]) => local === id)).map((id): RealInstrument => ({
    id,
    name: humanize(id),
    group: 'Other',
    local: false,
    gain: 0,
    parts: BASSY.test(id) ? ['bass'] : SUSTAINED.test(id) ? ['chords', 'lead'] : ['lead', 'chords'],
    release: SUSTAINED.test(id) ? 0.8 : 0.4,
  })),
]

export function getInstrument(id: string | undefined): RealInstrument | undefined {
  return id ? INSTRUMENT_LIBRARY.find((instrument) => instrument.id === id) : undefined
}

export const REMOTE_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'

/** The notes each instrument is sampled at (C and G-flat in every octave); the sampler fills the gaps. */
export const SAMPLED_NOTES = [1, 2, 3, 4, 5, 6].flatMap((octave) => [`C${octave}`, `Gb${octave}`])

/** Where to load an instrument's notes: Tone.Sampler takes { note: file } plus a base URL. */
export function instrumentSource(id: string): { baseUrl: string; urls: Record<string, string> } | undefined {
  const instrument = getInstrument(id)
  if (!instrument) return undefined
  const urls = Object.fromEntries(SAMPLED_NOTES.map((note) => [note.replace('Gb', 'F#'), `${note}.mp3`]))
  return { baseUrl: instrument.local ? `/instruments/${id}/` : `${REMOTE_BASE}${id}-mp3/`, urls }
}

/** Instruments that suit a part, local ones first, for pickers and "something different". */
export function instrumentsFor(part: SynthPart, localOnly = false): RealInstrument[] {
  return INSTRUMENT_LIBRARY.filter((instrument) => instrument.parts.includes(part) && (!localOnly || instrument.local))
}

/** Bundled real drum kits (public/drums). Voices a kit lacks stay synthesized. */
export const DRUM_SETS = [
  { id: 'acoustic', name: 'Acoustic kit', note: 'Recorded drums (VCSL, CC0)' },
  { id: 'tr808', name: 'TR-808', note: 'The classic drum machine (Michael Fischer samples)' },
] as const

export type DrumSetId = (typeof DRUM_SETS)[number]['id']

export const isDrumSet = (value: unknown): value is DrumSetId => DRUM_SETS.some((set) => set.id === value)

export const drumSetUrl = (set: DrumSetId, voice: string) => `/drums/${set}/${voice}.mp3`

const NAME_WORDS: [RegExp, string][] = [
  [/\bsax(ophone)?s?\b/, 'alto_sax'], [/\btenor sax\b/, 'tenor_sax'], [/\bbaritone sax\b/, 'baritone_sax'],
  [/\bbanjos?\b/, 'banjo'], [/\bharmonicas?\b/, 'harmonica'], [/\baccordions?\b/, 'accordion'], [/\bbagpipes?\b/, 'bagpipe'],
  [/\bclarinets?\b/, 'clarinet'], [/\boboes?\b/, 'oboe'], [/\bbassoons?\b/, 'bassoon'], [/\btubas?\b/, 'tuba'], [/\btrombones?\b/, 'trombone'],
  [/\bfrench horns?\b/, 'french_horn'], [/\bharps?\b/, 'orchestral_harp'], [/\bharpsichords?\b/, 'harpsichord'], [/\bclavinet\b|\bclavi\b/, 'clavinet'],
  [/\bcelesta\b/, 'celesta'], [/\bglockenspiel\b/, 'glockenspiel'], [/\bxylophones?\b/, 'xylophone'], [/\bkalimbas?\b/, 'kalimba'],
  [/\bkotos?\b/, 'koto'], [/\bshamisen\b/, 'shamisen'], [/\bshakuhachi\b/, 'shakuhachi'], [/\bocarinas?\b/, 'ocarina'], [/\bpiccolos?\b/, 'piccolo'],
  [/\bviolas?\b/, 'viola'], [/\bcellos?\b/, 'cello'], [/\bcontrabass\b/, 'contrabass'], [/\btremolo strings\b/, 'tremolo_strings'],
  [/\bchurch organ\b|\bpipe organ\b/, 'church_organ'], [/\bhonky ?tonk\b/, 'honkytonk_piano'], [/\bjazz guitar\b/, 'electric_guitar_jazz'],
  [/\bdulcimer\b/, 'dulcimer'], [/\btaiko\b/, 'taiko_drum'], [/\btimpani\b/, 'timpani'], [/\btubular bells\b|\bchurch bells?\b/, 'tubular_bells'],
  [/\bsteel ?(drums?|pans?)\b/, 'steel_drums'], [/\bsitars?\b/, 'sitar'], [/\bvibes\b|\bvibraphone\b/, 'vibraphone'], [/\bmarimbas?\b/, 'marimba'],
  [/\bmusic ?box\b/, 'music_box'], [/\borchestra hits?\b/, 'orchestra_hit'], [/\bmuted trumpet\b/, 'muted_trumpet'], [/\bpan ?flutes?\b|\bpan ?pipes?\b/, 'pan_flute'],
  [/\brecorders?\b/, 'recorder'], [/\bwhistl(e|ing)\b/, 'whistle'], [/\bfiddles?\b/, 'fiddle'], [/\boohs\b/, 'voice_oohs'],
]

/** A General MIDI instrument named in the text that the sound designer has no special entry for. */
export function namedInstrument(text: string): RealInstrument | undefined {
  const lower = text.toLowerCase()
  for (const [pattern, id] of NAME_WORDS) if (pattern.test(lower)) return getInstrument(id)
  return undefined
}
