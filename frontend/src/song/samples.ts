import { DRUM_LABELS, DRUM_VOICES, type DrumVoice } from '../beatmaker/genres/types'

/**
 * Real recorded drum hits from Freesound (freesound.org) that replace a synthesized drum.
 * Pure: how to search for a sound, how to read its licence, and how Fret reads requests for
 * samples. The network calls live in services/freesound.ts and api/sounds.ts.
 */

export type SampleLicense = 'CC0' | 'CC BY' | 'CC BY-NC' | 'Other'

export interface SampleRef {
  source: 'freesound'
  id: number
  name: string
  author: string
  license: SampleLicense
  licenseUrl: string
  /** The sound's page on freesound.org (credit link). */
  page: string
  /** The MP3 preview that plays in the song. */
  url: string
  duration: number
}

export type SongSamples = Partial<Record<DrumVoice, SampleRef>>

const PREVIEW_HOST = 'https://cdn.freesound.org/previews/'

export function licenseOf(url: string): SampleLicense {
  const text = url.toLowerCase()
  if (/publicdomain\/zero|\bcc0\b|creative commons 0/.test(text)) return 'CC0'
  if (/by-nc|noncommercial/.test(text)) return 'CC BY-NC'
  if (/licenses\/by\/|^attribution$/.test(text)) return 'CC BY'
  return 'Other'
}

/** True when a song using this sample can be sold or monetized (with credit for CC BY). */
export const commercialOk = (license: SampleLicense) => license === 'CC0' || license === 'CC BY'

export function creditLine(sample: SampleRef): string {
  return `"${sample.name}" by ${sample.author} (${sample.license}) ${sample.page}`
}

/** Credits for every sample in a song, for a release description. Empty when none need credit. */
export function songCredits(samples: SongSamples | undefined): string[] {
  return Object.values(samples ?? {}).filter((sample): sample is SampleRef => Boolean(sample)).map(creditLine)
}

/** Checks a sample that came from storage or the AI before it reaches the audio engine. */
export function validSample(value: unknown): SampleRef | undefined {
  if (!value || typeof value !== 'object') return undefined
  const s = value as Partial<SampleRef>
  if (s.source !== 'freesound' || typeof s.url !== 'string' || !s.url.startsWith(PREVIEW_HOST)) return undefined
  if (typeof s.id !== 'number' || typeof s.name !== 'string' || typeof s.author !== 'string') return undefined
  const license = s.license && ['CC0', 'CC BY', 'CC BY-NC', 'Other'].includes(s.license) ? s.license : 'Other'
  return {
    source: 'freesound',
    id: s.id,
    name: s.name.slice(0, 120),
    author: s.author.slice(0, 80),
    license,
    licenseUrl: typeof s.licenseUrl === 'string' ? s.licenseUrl : '',
    page: typeof s.page === 'string' && s.page.startsWith('https://freesound.org/') ? s.page : `https://freesound.org/s/${s.id}/`,
    url: s.url,
    duration: typeof s.duration === 'number' && Number.isFinite(s.duration) ? s.duration : 0,
  }
}

/** Words Freesound users tag each drum with. */
const SEARCH_WORDS: Record<DrumVoice, string> = {
  kick: 'kick drum',
  snare: 'snare drum',
  clap: 'clap',
  rim: 'rimshot',
  closedHat: 'closed hihat',
  openHat: 'open hihat',
  ride: 'ride cymbal',
  crash: 'crash cymbal',
  tomHigh: 'high tom',
  tomLow: 'floor tom',
}

/** Longest a one-shot may be, in seconds. Cymbals ring longer. */
const MAX_SECONDS: Record<DrumVoice, number> = { kick: 2, snare: 2, clap: 2, rim: 1.5, closedHat: 1.5, openHat: 3, ride: 6, crash: 6, tomHigh: 3, tomLow: 3 }

/** The Freesound search for one drum: its name plus the describing words, single hits only. */
export function sampleSearch(voice: DrumVoice, description = '', allowNonCommercial = false): { query: string; filter: string } {
  const words = description.toLowerCase().replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim()
  const query = [words, SEARCH_WORDS[voice]].filter(Boolean).join(' ').slice(0, 120)
  const licenses = allowNonCommercial ? '("Creative Commons 0" OR "Attribution" OR "Attribution NonCommercial")' : '("Creative Commons 0" OR "Attribution")'
  return { query, filter: `duration:[0.03 TO ${MAX_SECONDS[voice]}] license:${licenses}` }
}

/** Freesound's search result for one sound, the fields we ask for. */
export interface FreesoundHit {
  id: number
  name: string
  username: string
  license: string
  duration: number
  url?: string
  previews?: Record<string, string>
}

export function toSampleRef(hit: FreesoundHit): SampleRef | undefined {
  const url = hit.previews?.['preview-hq-mp3'] ?? hit.previews?.['preview-lq-mp3']
  return validSample({
    source: 'freesound',
    id: hit.id,
    name: hit.name.replace(/\.(wav|aiff?|mp3|flac|ogg)$/i, ''),
    author: hit.username,
    license: licenseOf(hit.license),
    licenseUrl: hit.license,
    page: hit.url ?? `https://freesound.org/s/${hit.id}/`,
    url,
    duration: hit.duration,
  })
}

const KIT_WORDS = /\b(drums?|drum ?kit|kit)\b/
const KIT: DrumVoice[] = ['kick', 'snare', 'closedHat']

const VOICE_WORDS: [RegExp, DrumVoice[]][] = [
  [/\bkicks?\b|\bbass ?drums?\b/, ['kick']],
  [/\bsnares?\b/, ['snare']],
  [/\bclaps?\b|\bhand ?claps?\b/, ['clap']],
  [/\brim ?(shot)?s?\b|\bside ?stick\b/, ['rim']],
  [/\bopen (hi-?)?hats?\b/, ['openHat']],
  [/\b(closed )?(hi-?)?hats?\b|\bhi-?hats?\b/, ['closedHat']],
  [/\brides?\b/, ['ride']],
  [/\bcrash(es)?\b|\bcymbals?\b/, ['crash']],
  [/\bfloor toms?\b|\blow toms?\b/, ['tomLow']],
  [/\btoms?\b/, ['tomHigh', 'tomLow']],
]

const SAMPLE_TALK = /\b(real|recorded|sampled?s?|freesound|acoustic|live recorded|actual)\b/
const FIND = /\b(find|search|look for|get|grab|dig up|swap|load)\b/

function voicesIn(text: string): DrumVoice[] {
  const found: DrumVoice[] = []
  let rest = text
  for (const [pattern, voices] of VOICE_WORDS) {
    if (!pattern.test(rest)) continue
    // "open hat" shouldn't also count as a closed hat, and "drum kit" shouldn't count as a kick.
    rest = rest.replace(pattern, ' ')
    for (const voice of voices) if (!found.includes(voice)) found.push(voice)
  }
  // "drums" or "kit" alone means the main three; a named drum ("a real snare drum") wins.
  return found.length ? found : KIT_WORDS.test(text) ? [...KIT] : []
}

const FILLER = /\b(please|can you|could you|i want|i'd like|give me|use|add|put|make|find|search|look for|get|grab|dig up|swap|load|freesound|on|from|for|the|a|an|some|me|my|it|its|this|song|track|real|recorded|sampled?s?|samples?|sound(s|ing)?|instead|of|with|in|to|one|actual|acoustic|live|drums?|kit|kicks?|snares?|claps?|hats?|hi-?hats?|open|closed|rides?|crash(es)?|cymbals?|toms?|floor|bass|rim ?(shot)?s?)\b/g

/**
 * Reads "use a real snare", "find me a dirtier kick on freesound", "sampled drums".
 * Returns the drums and the describing words, or undefined when it isn't a sample request.
 */
export function parseSampleRequest(input: string): { voices: DrumVoice[]; description: string } | undefined {
  const text = input.toLowerCase()
  if (!SAMPLE_TALK.test(text) && !(FIND.test(text) && /\bsamples?\b/.test(text))) return undefined
  if (/\b(no|remove|without|drop|ditch|back to)\b.*\b(samples?|synth)\b|\bsynth(esized)? (drums?|kick|snare)\b/.test(text)) return undefined
  const voices = voicesIn(text)
  if (!voices.length) return undefined
  const description = text.replace(FILLER, ' ').replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ').trim()
  return { voices, description }
}

/** Reads "back to synth drums", "remove the samples", "synth snare again". */
export function parseRemoveSamples(input: string): DrumVoice[] | 'all' | undefined {
  const text = input.toLowerCase()
  if (!/\b(no|remove|without|drop|ditch|back to|clear|delete)\b.*\b(samples?|synth(esized)?)\b|\bsynth(esized)? (drums?|kick|snare|hats?)\b.*\b(again|back)\b/.test(text)) return undefined
  const voices = voicesIn(text.replace(/\bsynth(esized)? drums?\b/, ' '))
  return voices.length ? voices : 'all'
}

export const sampleLabel = (voice: DrumVoice) => DRUM_LABELS[voice].toLowerCase()

export { DRUM_VOICES }
