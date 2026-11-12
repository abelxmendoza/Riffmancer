import type { GenreDefinition } from '../beatmaker/genres'
import { pick, type Random } from './random'
import type { SoundPart } from './sound'
import type { StructureItem } from './generate'

/**
 * Sound palettes: for each genre, several believable choices per part, in the same plain words
 * a person types ("picked bass, distorted"). The "Next" button and new songs draw from these, so
 * every press can land on a different band: real recorded bass, guitars, keys and drum kits mixed
 * with synths where the genre calls for them.
 */
export type Palette = Record<SoundPart, string[]>

export const PALETTES: Record<string, Palette> = {
  'post-punk': {
    bass: ['picked bass, punchy', 'picked bass, bright, wide', 'bass guitar, dark', 'fuzz bass', 'synth bass, dark', 'fretless bass, spacey'],
    chords: ['clean guitar, wide, echoey', 'clean guitar, spacey, dark', 'distorted guitar, thin', 'synth strings, dark', 'organ, thin', 'pad, dark, spacey', 'acoustic guitar, echoey'],
    lead: ['clean guitar, echoey', 'bells, spacey', 'saw lead, dark', 'violin, spacey', 'electric piano, echoey', 'synth strings, high'],
    drums: ['live drums, dry, punchy', 'drum machine, roomy', 'live drums, roomy', 'drum machine, thin', '808 drums, dry'],
  },
  metal: {
    bass: ['picked bass, distorted', 'bass guitar, distorted, dark', 'fuzz bass, fat', 'picked bass, dark'],
    chords: ['distorted guitar, fat', 'palm-muted guitar, heavy', 'distorted guitar, dark, wide', 'guitar, punchy', 'distorted guitar, dry'],
    lead: ['guitar solo', 'guitar solo, spacey', 'choir, dark', 'strings, dark', 'organ, distorted', 'violin, dark'],
    drums: ['live drums, punchy, dry', 'live drums, roomy, fat', 'live drums, trashy, punchy'],
  },
  punk: {
    bass: ['picked bass, punchy', 'picked bass, distorted', 'bass guitar, bright', 'fuzz bass'],
    chords: ['distorted guitar, punchy', 'guitar, bright', 'distorted guitar, thin', 'palm-muted guitar', 'distorted guitar, roomy'],
    lead: ['guitar solo, dry', 'organ', 'clean guitar, bright', 'distorted guitar, thin', 'piano, bright'],
    drums: ['live drums, punchy', 'live drums, trashy, roomy', 'live drums, dry'],
  },
  'drum-and-bass': {
    bass: ['reese bass', 'sub bass', 'wobble bass', 'reese bass, wide', 'upright bass, dark', 'fuzz bass'],
    chords: ['pad, spacey', 'electric piano, spacey', 'strings, dark', 'choir, spacey', 'synth stabs', 'piano, spacey'],
    lead: ['bells, echoey', 'flute, spacey', 'saw lead', 'pluck, echoey', 'vibraphone, echoey', 'saxophone, spacey'],
    drums: ['breakbeat drums', 'breakbeat drums, punchy', 'drum machine, punchy', 'live drums, dry, punchy'],
  },
  reggaeton: {
    bass: ['808 bass', 'sub bass', '808 bass, distorted', 'bass guitar, dark', 'synth bass, plucky'],
    chords: ['nylon guitar', 'piano', 'electric piano', 'synth stabs', 'pad, wide', 'acoustic guitar'],
    lead: ['marimba', 'saw lead', 'flute', 'pluck, echoey', 'steel drums', 'trumpet', 'nylon guitar, echoey'],
    drums: ['808 drums', 'drum machine, punchy', '808 drums, dry', 'drum machine, roomy'],
  },
  'boom-bap': {
    bass: ['upright bass', 'bass guitar, dark', 'sub bass', 'fretless bass'],
    chords: ['electric piano, thin', 'piano, thin', 'strings, thin', 'organ, soft', 'nylon guitar, thin', 'vibraphone'],
    lead: ['flute, soft', 'vibraphone', 'saxophone', 'bells, thin', 'trumpet, thin', 'clean guitar, thin'],
    drums: ['breakbeat drums, thin', 'live drums, thin, dry', 'drum machine, thin', '808 drums'],
  },
  house: {
    bass: ['synth bass', 'acid bass', 'sub bass', 'slap bass', 'bass guitar, plucky'],
    chords: ['piano, bright', 'organ', 'electric piano', 'synth stabs', 'strings', 'choir'],
    lead: ['pluck', 'bells', 'saw lead', 'saxophone', 'marimba', 'trumpet'],
    drums: ['drum machine, punchy', 'drum machine, roomy', '808 drums', 'live drums, dry'],
  },
}

const GENERIC: Palette = {
  bass: ['bass guitar', 'picked bass', 'synth bass', 'sub bass', 'upright bass'],
  chords: ['clean guitar', 'distorted guitar', 'piano', 'electric piano', 'pad', 'strings', 'organ'],
  lead: ['bells', 'saw lead', 'flute', 'guitar solo', 'violin', 'saxophone'],
  drums: ['live drums', 'drum machine', '808 drums', 'breakbeat drums'],
}

export function paletteFor(genreId: string): Palette {
  return PALETTES[genreId] ?? GENERIC
}

/** One choice per part. `avoid` holds the current choices, so the next pick sounds different. */
export function pickSounds(genreId: string, random: Random, avoid: Partial<Record<SoundPart, string>> = {}): Record<SoundPart, string> {
  const palette = paletteFor(genreId)
  const choose = (part: SoundPart) => {
    const options = palette[part].filter((option) => option !== avoid[part])
    return pick(random, options.length ? options : palette[part])
  }
  return { bass: choose('bass'), chords: choose('chords'), lead: choose('lead'), drums: choose('drums') }
}

/** A tempo anywhere in the genre's range, so two songs in a row don't share a pulse. */
export function pickTempo(genre: GenreDefinition, random: Random, avoid?: number): number {
  const { min, max } = genre.bpm
  for (let tries = 0; tries < 6; tries += 1) {
    const bpm = Math.round(min + random() * (max - min))
    if (avoid === undefined || Math.abs(bpm - avoid) >= Math.min(8, (max - min) / 3)) return bpm
  }
  return Math.round(min + random() * (max - min))
}

export function pickRoot(random: Random, avoid?: number): number {
  const root = Math.floor(random() * 12) % 12
  return root === avoid ? (root + 5) % 12 : root
}

/**
 * The genre's song shape with some changes: a longer or shorter intro, the bridge dropped or
 * swapped, a last double chorus. Same genre, different journey.
 */
export function varyStructure(base: StructureItem[], random: Random): StructureItem[] {
  const shape = base.map((item) => ({ ...item }))
  if (shape[0]?.kind === 'intro') shape[0].bars = pick(random, [2, 4, 8].filter((bars) => bars <= Math.max(4, shape[0].bars * 2)))
  const middle = shape.findIndex((item) => item.kind === 'bridge' || item.kind === 'breakdown' || item.kind === 'break')
  const roll = random()
  if (middle > 0 && roll < 0.3) shape.splice(middle, 1)
  else if (middle > 0 && roll < 0.6) shape[middle] = { ...shape[middle], kind: shape[middle].kind === 'bridge' ? 'breakdown' : 'bridge' }
  const lastLoud = shape.map((item) => item.kind).lastIndexOf(shape.some((item) => item.kind === 'drop') ? 'drop' : 'chorus')
  if (lastLoud > 0 && random() < 0.4) shape.splice(lastLoud + 1, 0, { ...shape[lastLoud] })
  return shape
}
