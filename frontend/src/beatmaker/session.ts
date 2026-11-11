import type { KeyboardMode } from './input/keymap'
import { getGenre, type GenreDefinition, type SynthPatch } from './genres'
import { parseDrumPattern, type DrumGrid } from './pattern'
import type { Variation } from './conductor'
import { SCALES, type ScaleName } from './theory'
import type { MixPart, SynthPart } from './engine/types'

/** Everything about the current beat. Saved in the browser so work survives a reload. */
export interface Session {
  version: 1
  genreId: string
  bpm: number
  swing: number
  root: number
  scale: ScaleName
  variation: Variation
  grids: Record<Variation, DrumGrid>
  progression: number[]
  parts: { drums: boolean; bass: boolean; chords: boolean }
  levels: Record<MixPart, number>
  patches: Record<SynthPart, SynthPatch>
  keyboard: { mode: KeyboardMode; splitNote: number; scaleLock: boolean }
}

export const DEFAULT_LEVELS: Record<MixPart, number> = { drums: 0.9, bass: 0.85, chords: 0.75, lead: 0.8 }

export function sessionForGenre(genre: GenreDefinition, previous?: Session): Session {
  return {
    version: 1,
    genreId: genre.id,
    bpm: genre.bpm.default,
    swing: genre.swing,
    root: genre.key.root,
    scale: genre.key.scale,
    variation: 'main',
    grids: { main: parseDrumPattern(genre.drums.main), alt: parseDrumPattern(genre.drums.alt) },
    progression: [...genre.progression],
    parts: previous?.parts ?? { drums: true, bass: true, chords: true },
    levels: previous?.levels ?? { ...DEFAULT_LEVELS },
    patches: { bass: genre.sounds.bass, chords: genre.sounds.chords, lead: genre.sounds.lead },
    keyboard: previous?.keyboard ?? { mode: 'band', splitNote: 60, scaleLock: true },
  }
}

const STORAGE_KEY = 'riffmancer.beatmaker.session'

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Session>
  return candidate.version === 1
    && typeof candidate.genreId === 'string'
    && typeof candidate.bpm === 'number'
    && typeof candidate.root === 'number'
    && typeof candidate.scale === 'string' && candidate.scale in SCALES
    && Array.isArray(candidate.progression)
    && Boolean(candidate.grids?.main && candidate.grids?.alt)
    && Boolean(candidate.patches?.lead && candidate.patches?.bass && candidate.patches?.chords)
    && Boolean(candidate.keyboard && candidate.parts && candidate.levels)
}

export function loadSession(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): Session {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isSession(parsed)) return parsed
    }
  } catch {
    // Corrupt or blocked storage: fall through to a fresh session.
  }
  return sessionForGenre(getGenre('post-punk'))
}

export function saveSession(session: Session, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage full or blocked: the beat still plays, it just won't survive a reload.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
