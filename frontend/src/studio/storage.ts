import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval'
import { audioIdsIn, migrateProject, type StudioProject } from './project'

/**
 * Local-only storage for the Studio, in the browser's IndexedDB (via idb-keyval, Apache-2.0).
 * Nothing is uploaded. Imported files are stored exactly as imported; recorded takes are stored as
 * raw samples.
 */
export type StoredAudio =
  | { kind: 'file'; name: string; blob: Blob }
  | { kind: 'pcm'; sampleRate: number; channels: Float32Array[] }

const PROJECT_KEY = 'project:current'
const INBOX_KEY = 'inbox'

let store: UseStore | undefined
function db(): UseStore | undefined {
  if (typeof indexedDB === 'undefined') return undefined
  store ??= createStore('riffmancer-studio', 'files')
  return store
}

export async function saveProject(project: StudioProject): Promise<void> {
  const target = db()
  if (target) await set(PROJECT_KEY, project, target)
}

export async function loadProject(): Promise<StudioProject | undefined> {
  const target = db()
  if (!target) return undefined
  try {
    return migrateProject(await get(PROJECT_KEY, target))
  } catch {
    return undefined
  }
}

export async function saveAudio(id: string, audio: StoredAudio): Promise<void> {
  const target = db()
  if (target) await set(`audio:${id}`, audio, target)
}

export async function loadAudio(id: string): Promise<StoredAudio | undefined> {
  const target = db()
  return target ? get<StoredAudio>(`audio:${id}`, target) : undefined
}

/** Deletes stored audio the project no longer uses (deleted takes and tracks). */
export async function pruneAudio(project: StudioProject): Promise<number> {
  const target = db()
  if (!target) return 0
  const used = audioIdsIn(project)
  let removed = 0
  for (const key of await keys(target)) {
    if (typeof key === 'string' && key.startsWith('audio:') && !used.has(key.slice(6))) {
      await del(key, target)
      removed++
    }
  }
  return removed
}

/** A bounce handed over from another screen (the Beat Maker's "Send to Studio"). */
export async function sendToStudio(name: string, blob: Blob): Promise<void> {
  const target = db()
  if (!target) throw new Error('This browser has no local storage for the Studio.')
  const inbox = (await get<{ name: string; blob: Blob }[]>(INBOX_KEY, target)) ?? []
  await set(INBOX_KEY, [...inbox, { name, blob }], target)
}

export async function takeInbox(): Promise<{ name: string; blob: Blob }[]> {
  const target = db()
  if (!target) return []
  const inbox = (await get<{ name: string; blob: Blob }[]>(INBOX_KEY, target)) ?? []
  if (inbox.length) await del(INBOX_KEY, target)
  return inbox
}
