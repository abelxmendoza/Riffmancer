import { drumAndBass } from './drumAndBass'
import { boomBap, house } from './extras'
import { metal } from './metal'
import { postPunk } from './postPunk'
import { punk } from './punk'
import { reggaeton } from './reggaeton'
import { EXTRA_PATCHES } from './patches'
import type { GenreDefinition, SynthPatch } from './types'

export * from './types'
export { DEFAULT_KIT, DEFAULT_PATCH } from './patches'

/**
 * The genre registry. To add a genre, create a file like `postPunk.ts` and add it here.
 * The Beat Maker, synth presets, and tests pick it up automatically.
 */
export const GENRES: GenreDefinition[] = [postPunk, metal, punk, drumAndBass, reggaeton, boomBap, house]

export function getGenre(id: string): GenreDefinition {
  return GENRES.find((genre) => genre.id === id) ?? GENRES[0]
}

/** Every synth sound available in the synth panel: each genre's lead, chord, and bass sounds plus extras. */
export function allPatches(): SynthPatch[] {
  const seen = new Set<string>()
  const list: SynthPatch[] = []
  for (const candidate of [...GENRES.flatMap((genre) => [genre.sounds.lead, genre.sounds.chords, genre.sounds.bass]), ...EXTRA_PATCHES]) {
    if (seen.has(candidate.name)) continue
    seen.add(candidate.name)
    list.push(candidate)
  }
  return list
}
