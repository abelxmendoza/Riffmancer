import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME_ID, getAppTheme, themeForGenre, type AppTheme } from './themes'

/**
 * The app's current colour theme, saved in this browser. Changing it rewrites a few CSS variables
 * on <html>, which every Tailwind colour (bg-primary, text-foreground/60...) reads.
 */
export interface ThemeState {
  id: string
  /** Switch the theme to fit the genre of the song being worked on. */
  follow: boolean
}

const KEY = 'riffmancer.theme'
const listeners = new Set<() => void>()
let state: ThemeState = load()

function load(): ThemeState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<ThemeState> | null
    return { id: getAppTheme(parsed?.id).id, follow: parsed?.follow ?? true }
  } catch {
    return { id: DEFAULT_THEME_ID, follow: true }
  }
}

/** Writes a theme's colours onto the page. */
export function paintTheme(theme: AppTheme, root: HTMLElement = document.documentElement) {
  const { colors } = theme
  root.style.setProperty('--color-background', colors.background)
  root.style.setProperty('--color-surface', colors.surface)
  root.style.setProperty('--color-primary', colors.primary)
  root.style.setProperty('--color-secondary', colors.secondary)
  root.style.setProperty('--color-foreground', colors.foreground)
  root.style.setProperty('--emblem-filter', theme.emblem)
  root.dataset.theme = theme.id
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', colors.background)
}

function set(next: ThemeState) {
  if (next.id === state.id && next.follow === state.follow) return
  state = next
  try { window.localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage blocked */ }
  paintTheme(getAppTheme(state.id))
  listeners.forEach((listener) => listener())
}

export const getThemeState = () => state

/** Picks a theme by hand. Turns off "match my song" unless asked to keep it. */
export function setTheme(id: string, follow = false) {
  set({ id: getAppTheme(id).id, follow })
}

export function setFollowSong(follow: boolean) {
  set({ ...state, follow })
}

/** Called when the song or session genre changes. Only moves the theme while "match my song" is on. */
export function followGenre(genreId: string | undefined) {
  if (!genreId || !state.follow) return
  set({ ...state, id: themeForGenre(genreId).id })
}

export function startTheme() {
  paintTheme(getAppTheme(state.id))
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useThemeState(): ThemeState {
  return useSyncExternalStore(subscribe, getThemeState, getThemeState)
}

export function useAppTheme(): AppTheme {
  return getAppTheme(useThemeState().id)
}

/** Applies what Fret understood: a named theme, or "match my song". */
export function applyThemeRequest(request: { themeId?: string; follow?: boolean }) {
  if (request.themeId) setTheme(request.themeId, false)
  else if (request.follow) setFollowSong(true)
}
