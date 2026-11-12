/**
 * App-wide colour themes, one per genre the person plays. The ids match the Player's visualizer
 * themes, so picking one in either place changes both. Pure data plus a few pure helpers.
 */
export interface AppTheme {
  id: string
  name: string
  /** The genre it was made for, shown as a hint. */
  vibe: string
  /** Genre engine ids that switch to this theme when "match my song" is on. */
  genres: string[]
  colors: {
    background: string
    surface: string
    primary: string
    secondary: string
    foreground: string
  }
  /** CSS filter that recolours the green skull emblem artwork to fit. */
  emblem: string
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'toxic', name: 'Toxic', vibe: 'Riffmancer', genres: ['boom-bap', 'house'],
    colors: { background: '#080E0D', surface: '#14201B', primary: '#A3E635', secondary: '#22C55E', foreground: '#E5F7E7' },
    emblem: 'none',
  },
  {
    id: 'blood', name: 'Blood Moon', vibe: 'Metal', genres: ['metal'],
    colors: { background: '#0C0506', surface: '#1F1012', primary: '#F87171', secondary: '#DC2626', foreground: '#FBEAEA' },
    emblem: 'url(#emblem-blood)',
  },
  {
    id: 'coldwave', name: 'Coldwave', vibe: 'Post punk', genres: ['post-punk'],
    colors: { background: '#07080C', surface: '#141821', primary: '#E2E8F0', secondary: '#94A3B8', foreground: '#F1F5F9' },
    emblem: 'grayscale(1) brightness(1.15) contrast(1.1)',
  },
  {
    id: 'neon', name: 'Neon Rave', vibe: 'Drum & bass', genres: ['drum-and-bass'],
    colors: { background: '#07051A', surface: '#151135', primary: '#22D3EE', secondary: '#A78BFA', foreground: '#EDE9FE' },
    emblem: 'hue-rotate(95deg) saturate(1.4)',
  },
  {
    id: 'fuego', name: 'Fuego', vibe: 'Reggaeton', genres: ['reggaeton'],
    colors: { background: '#0E0604', surface: '#24130C', primary: '#FB923C', secondary: '#F472B6', foreground: '#FFF1E6' },
    emblem: 'hue-rotate(-100deg) saturate(1.4)',
  },
  {
    id: 'riot', name: 'Riot', vibe: 'Punk', genres: ['punk'],
    colors: { background: '#0B0B06', surface: '#1E1D10', primary: '#FACC15', secondary: '#EC4899', foreground: '#FEFCE8' },
    emblem: 'grayscale(1) sepia(1) saturate(5) hue-rotate(12deg) brightness(1.15)',
  },
]

export const DEFAULT_THEME_ID = 'toxic'

export function getAppTheme(id: string | undefined): AppTheme {
  return APP_THEMES.find((theme) => theme.id === id) ?? APP_THEMES[0]
}

/** The theme that fits a genre engine id (Toxic when none is tuned for it). */
export function themeForGenre(genreId: string): AppTheme {
  return APP_THEMES.find((theme) => theme.genres.includes(genreId)) ?? APP_THEMES[0]
}

const NAMES: [RegExp, string][] = [
  [/\btoxic\b|\bgreen\b|\bdefault (look|theme|colou?rs?)\b|\boriginal (look|theme|colou?rs?)\b/, 'toxic'],
  [/\bblood( moon)?\b|\bred\b|\bmetal\b/, 'blood'],
  [/\bcold ?wave\b|\bpost[ -]?punk\b|\bblack and white\b|\bmonochrome\b|\bgr[ae]y\b|\bsilver\b/, 'coldwave'],
  [/\bneon( rave)?\b|\bcyan\b|\bpurple\b|\bdrum (and|&|n) bass\b|\bdnb\b|\brave\b/, 'neon'],
  [/\bfuego\b|\borange\b|\breggaeton\b|\bpink and orange\b/, 'fuego'],
  [/\briot\b|\byellow\b|\bpunk\b/, 'riot'],
]

/**
 * Reads a request to change how the app looks ("make it look metal", "blood moon theme",
 * "match my song's colours"). Returns undefined when the text isn't about the app's look.
 */
export function parseThemeRequest(input: string): { themeId?: string; follow?: boolean } | undefined {
  const text = input.toLowerCase()
  const aboutLook = /\b(theme|colou?r(s| scheme)?|skin|look(s)?|palette|vibe of the (app|site)|make (the )?(app|site|it) look)\b/.test(text)
  if (!aboutLook) return undefined
  if (/\b(match|follow)\b.*\b(song|genre|music)\b|\bauto(matic)?\b/.test(text)) return { follow: true }
  for (const [pattern, id] of NAMES) if (pattern.test(text)) return { themeId: id, follow: false }
  return undefined
}

/** What Fret says and does for a request about the app's look, or undefined when it isn't one. */
export function themeReply(input: string): { text: string; theme: { themeId?: string; follow?: boolean } } | undefined {
  const request = parseThemeRequest(input)
  if (!request) return undefined
  if (request.follow) return { text: "🎨 Colours will follow your song's genre now: Coldwave for post punk, Blood Moon for metal, Riot for punk, Neon Rave for drum & bass, Fuego for reggaeton.", theme: request }
  const theme = getAppTheme(request.themeId)
  return { text: `🎨 ${theme.name} it is (made for ${theme.vibe.toLowerCase()}). Pick another from the swatch at the top, or say "match my song" to let the genre choose.`, theme: request }
}
