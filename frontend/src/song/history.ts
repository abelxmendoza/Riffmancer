import { isSongSpec, type SongSpec } from './spec'

/** One saved version of the song, with Fret's note about what changed. */
export interface SongVersion {
  song: SongSpec
  note: string
  at: number
  /** Hand edits from the drawer: consecutive ones with the same note are merged into one version. */
  hand?: boolean
}

export interface SongHistory {
  versions: SongVersion[]
  /** Index of the version on screen. */
  index: number
}

export const MAX_VERSIONS = 60
const STORAGE_KEY = 'riffmancer.create.history'

export const EMPTY_HISTORY: SongHistory = { versions: [], index: -1 }

export function currentVersion(history: SongHistory): SongVersion | undefined {
  return history.versions[history.index]
}

/** Adds a version after the current one (dropping any "redo" versions), like every editor's undo. */
export function commit(history: SongHistory, song: SongSpec, note: string, hand = false, now = Date.now()): SongHistory {
  const kept = history.versions.slice(0, history.index + 1)
  const last = kept.at(-1)
  if (hand && last?.hand && last.note === note) {
    kept[kept.length - 1] = { ...last, song, at: now }
    return { versions: kept, index: kept.length - 1 }
  }
  const versions = [...kept, { song, note, at: now, hand }].slice(-MAX_VERSIONS)
  return { versions, index: versions.length - 1 }
}

export function undo(history: SongHistory): SongHistory {
  return history.index > 0 ? { ...history, index: history.index - 1 } : history
}

export function redo(history: SongHistory): SongHistory {
  return history.index < history.versions.length - 1 ? { ...history, index: history.index + 1 } : history
}

export function goTo(history: SongHistory, index: number): SongHistory {
  return index >= 0 && index < history.versions.length ? { ...history, index } : history
}

export function loadHistory(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): SongHistory {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_HISTORY
    const parsed = JSON.parse(raw) as Partial<SongHistory>
    const versions = Array.isArray(parsed.versions) ? parsed.versions.filter((version) => version && typeof version.note === 'string' && isSongSpec(version.song)) : []
    if (!versions.length) return EMPTY_HISTORY
    const index = typeof parsed.index === 'number' ? Math.max(0, Math.min(versions.length - 1, parsed.index)) : versions.length - 1
    return { versions, index }
  } catch {
    return EMPTY_HISTORY
  }
}

export function saveHistory(history: SongHistory, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Storage full or blocked: the song still plays, it just won't survive a reload.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
