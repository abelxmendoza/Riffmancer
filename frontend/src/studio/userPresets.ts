import { setUserPresets, type VocalChain, type VocalPreset } from './presets'
import { sanitizeChain } from './vocalSound'

/** The person's own vocal presets, kept in this browser. */
const KEY = 'riffmancer.studio.userPresets'
const MAX = 40

function read(): VocalPreset[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is VocalPreset => Boolean(item) && typeof item.id === 'string' && typeof item.name === 'string' && Boolean(item.chain))
      .map((item) => ({ ...item, genre: 'mine', chain: sanitizeChain(item.chain) }))
  } catch {
    return []
  }
}

export function loadUserPresets(): VocalPreset[] {
  const list = typeof window === 'undefined' ? [] : read()
  setUserPresets(list)
  return list
}

/** Saves a preset (replacing one with the same name) and returns it. */
export function saveUserPreset(name: string, chain: VocalChain, description = 'Made with Fret.', role: VocalPreset['role'] = 'lead'): VocalPreset {
  const clean = name.trim().slice(0, 40) || 'My vocal'
  const existing = read()
  const id = `mine-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vocal'}`
  const preset: VocalPreset = { id, name: clean, genre: 'mine', role, description, tip: 'Your own preset. Every knob stays editable.', chain: sanitizeChain(chain) }
  const list = [...existing.filter((item) => item.id !== id), preset].slice(-MAX)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Storage full or blocked: the preset still works for this session.
  }
  setUserPresets(list)
  return preset
}

export function deleteUserPreset(id: string) {
  const list = read().filter((item) => item.id !== id)
  try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  setUserPresets(list)
}
