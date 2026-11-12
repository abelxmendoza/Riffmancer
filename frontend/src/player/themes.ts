/** Colour themes for the visualizers. Each one is tuned for a genre the person plays. */
export interface VisualTheme {
  id: string
  name: string
  /** The genre it was made for, shown as a hint. */
  vibe: string
  background: string
  /** Gradient stops from quiet to loud. */
  colors: string[]
  /** Colour for peaks, flashes and the beat ring. */
  accent: string
}

export const THEMES: VisualTheme[] = [
  { id: 'toxic', name: 'Toxic', vibe: 'Riffmancer', background: '#050a08', colors: ['#14532d', '#22c55e', '#a3e635', '#ecfccb'], accent: '#a3e635' },
  { id: 'blood', name: 'Blood Moon', vibe: 'Metal', background: '#0a0303', colors: ['#450a0a', '#b91c1c', '#ef4444', '#fde68a'], accent: '#f87171' },
  { id: 'coldwave', name: 'Coldwave', vibe: 'Post punk', background: '#05060a', colors: ['#1e293b', '#64748b', '#cbd5e1', '#ffffff'], accent: '#e2e8f0' },
  { id: 'neon', name: 'Neon Rave', vibe: 'Drum & bass', background: '#04020c', colors: ['#312e81', '#7c3aed', '#22d3ee', '#f0abfc'], accent: '#22d3ee' },
  { id: 'fuego', name: 'Fuego', vibe: 'Reggaeton', background: '#0c0503', colors: ['#7c2d12', '#ea580c', '#f472b6', '#fde047'], accent: '#fb923c' },
  { id: 'riot', name: 'Riot', vibe: 'Punk', background: '#0a0a05', colors: ['#3f3f46', '#ec4899', '#facc15', '#ffffff'], accent: '#facc15' },
]

export const getTheme = (id: string) => THEMES.find((theme) => theme.id === id) ?? THEMES[0]

/** Picks a colour along the theme's gradient for a 0..1 value. */
export function colorAt(theme: VisualTheme, value: number) {
  const stops = theme.colors
  const clamped = Math.max(0, Math.min(0.999, value))
  return stops[Math.floor(clamped * stops.length)]
}
