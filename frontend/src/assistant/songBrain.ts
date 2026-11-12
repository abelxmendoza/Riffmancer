import { getGenre, GENRES } from '../beatmaker/genres'
import { parseRemoveSamples, parseSampleRequest, sampleLabel } from '../song/samples'
import { DRUM_VOICES, type DrumVoice } from '../beatmaker/genres/types'
import { themeReply } from '../theme/themes'
import type { ScaleName } from '../beatmaker/theory'
import type { SongEdit, SoundDescriptions, Target } from '../song/edit'
import { describesSound, parseSoundRequests, type SoundRequest } from '../song/sound'
import { findStyle, getStyle, STYLE_VOCALS } from '../song/styles'
import { defaultPresetFor } from '../studio/presets'
import { describeVocal, vocalName } from '../studio/vocalSound'
import type { StudioAction } from './bus'
import { COPY_VOCAL } from './studioBrain'
import type { SectionKind, SectionParts, SongSpec } from '../song/spec'
import { findGenre, findKey, findSynthTweak, findTempo, normalize, type Mood } from './engine'
import { ASSISTANT_NAME } from './persona'

/**
 * Fret's offline brain for the Create screen: turns plain requests into song edits.
 * Runs with no network. Anything it doesn't understand is marked `unknown` so the live AI
 * (when the server has a key) can take over.
 */

export type PlayCommand = { type: 'play'; section?: number } | { type: 'stop' } | { type: 'loop'; section?: number }

export interface SongReply {
  text: string
  edits: SongEdit[]
  /** Moves through the version history instead of editing. */
  history?: 'undo' | 'redo'
  play?: PlayCommand
  unknown: boolean
  mood: Mood
  /** Vocal changes for the Studio (held until the Studio opens). */
  studio?: StudioAction[]
  /** Bounce the song and open it in the Studio to record vocals over it. */
  sendToStudio?: boolean
  /** Change the app's colour theme. */
  theme?: { themeId?: string; follow?: boolean }
  /** Search Freesound for real drum hits and put the best one on each drum (next: the next result). */
  samples?: { voices: DrumVoice[]; description: string; next?: boolean }
}

const VOCAL_TALK = /\b(vocals?|voice|singing|sing|vocal preset|mic)\b/
const TO_STUDIO = /\b(send|take|bring|move|open|put|export)\b.*\b(studio|vocal booth)\b|\b(record|sing|add|lay down|cut|put)\b (my |some |the |a )?(vocals?|singing|voice)\b|\bsing over\b|\brecord (over|on top of) (it|this|the song)\b/

/**
 * The vocal preset that fits a song: its style's usual vocal, the genre's lead preset, then
 * whatever the person described on top. Returns the Studio action and the words used.
 */
export function vocalPresetForSong(song: SongSpec, request = ''): { action: Extract<StudioAction, { type: 'customPreset' }>; words: string[]; missing: string[] } {
  const style = getStyle(song.style)
  const base = defaultPresetFor(song.genreId).chain
  const styled = style ? describeVocal(STYLE_VOCALS[style.id] ?? '', base) : { chain: base, words: [] as string[], missing: [] as string[] }
  const asked = request ? describeVocal(request, styled.chain) : { chain: styled.chain, words: [] as string[], missing: [] as string[] }
  const words = asked.words.length ? asked.words : styled.words
  const label = asked.words.length ? vocalName(asked.words) : `${style?.name ?? getGenre(song.genreId).name} vocal`
  const name = `${label} · ${song.title}`.slice(0, 40)
  return { action: { type: 'customPreset', name, chain: asked.chain, description: `For "${song.title}"${words.length ? `: ${words.join(', ')}` : ''}.` }, words, missing: asked.missing }
}

const KIND_WORDS: [RegExp, SectionKind][] = [
  [/\bintros?\b/, 'intro'],
  [/\bverses?\b/, 'verse'],
  [/\bbuild ?ups?\b|\bbuilds?\b|\briser\b/, 'build'],
  [/\bchorus(es)?\b|\bhooks?\b|\brefrain\b/, 'chorus'],
  [/\bdrops?\b/, 'drop'],
  [/\bbridges?\b|\bmiddle 8\b/, 'bridge'],
  [/\bbreakdowns?\b/, 'breakdown'],
  [/\bbreaks?\b(?! it)/, 'break'],
  [/\boutros?\b|\bending\b/, 'outro'],
]

const ORDINALS: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1, final: -1 }

/** "the chorus" → every chorus; "verse 2", "second verse", "last chorus" → one section. */
export function findTarget(text: string, song: SongSpec | undefined): Target | undefined {
  for (const [pattern, kind] of KIND_WORDS) {
    const match = text.match(pattern)
    if (!match) continue
    const after = text.slice((match.index ?? 0) + match[0].length).match(/^\s*(\d)\b/)
    const before = text.slice(0, match.index).match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|last|final)\s*$/)
    const number = after ? Number(after[1]) : before ? ORDINALS[before[1]] : undefined
    if (number === undefined || !song) return { kind }
    const indexes = song.sections.flatMap((section, index) => (section.kind === kind ? [index] : []))
    const chosen = number === -1 ? indexes.at(-1) : indexes[number - 1]
    return chosen === undefined ? { kind } : { section: chosen + 1 }
  }
  const position = text.match(/\b(?:section|part) (\d{1,2})\b/)
  if (position) return { section: Number(position[1]) }
  return undefined
}

const PART_WORDS: [RegExp, keyof SectionParts][] = [
  [/\bdrums?\b|\bbeat\b|\bpercussion\b/, 'drums'],
  [/\bbass(line)?\b/, 'bass'],
  [/\bchords?\b|\bguitars?\b|\bpads?\b|\bkeys\b/, 'chords'],
  [/\bmelody\b|\blead\b|\briff\b|\bhook line\b/, 'lead'],
]

function partsIn(text: string): (keyof SectionParts)[] {
  return PART_WORDS.filter(([pattern]) => pattern.test(text)).map(([, part]) => part)
}

const wantsNewSong = (text: string) =>
  /\b(make|create|write|generate|give|build|start|cook up|compose|produce|need|want)\b( me| us)? (a|an|some|another|new|one more)\b.*\b(song|track|beat|instrumental|tune|banger|jam)\b/.test(text)
  || /\b(new|fresh|different) (song|track|instrumental)\b/.test(text)
  || /^(a |an )?[a-z&' -]+ (song|track|instrumental)$/.test(text)

function bpmInRange(genreId: string, text: string): number | undefined {
  const tempo = findTempo(text)
  if (tempo?.bpm) return tempo.bpm
  const at = text.match(/\bat (\d{2,3})\b/)
  if (at) return Number(at[1])
  const genre = getGenre(genreId)
  if (tempo?.delta) return genre.bpm.default + tempo.delta
  return undefined
}

/** Turns "no distortion" into "clean" and the like, so describing words aren't read backwards. */
function soundText(text: string): string {
  return text
    .replace(/\b(no|less|without|zero|not so much|lose the) (distortion|fuzz|grit|drive)\b/g, 'clean')
    .replace(/\bnot (distorted|fuzzy|gritty)\b/g, 'clean')
    .replace(/\b(no|less|without|zero|lose the) (reverb|echo|delay|space)\b/g, 'dry')
    .replace(/\bless (bright|harsh)\b/g, 'dark')
    .replace(/\bless (dark|muddy|muffled)\b/g, 'bright')
    // Genre names that would read as instruments ("drum and bass", "metal guitars").
    .replace(/\bdrum (and|&|n) bass\b|\bd&b\b/g, 'dnb')
}

function descriptions(requests: SoundRequest[]): SoundDescriptions | undefined {
  if (!requests.length) return undefined
  return Object.fromEntries(requests.map((request) => [request.part, request.text]))
}

const GENERIC = new Set(['a', 'an', 'new', 'some', 'my', 'me', 'us', 'cool', 'sick', 'good', 'nice', 'dope', 'fire', 'banger', 'fast', 'slow', 'quick', 'short', 'long', 'one', 'more', 'another', 'different', 'fresh', 'random', 'whole', 'full', 'real', 'great', 'little', 'big'])

/** The words between "a" and "song" that aren't Fret's genre words ("make a polka song" → "polka"). */
function namedGenre(text: string): string | undefined {
  const match = text.match(/\b(?:a|an|some|new|another)\s+([a-z&' -]{2,40}?)\s+(?:song|track|beat|instrumental|tune|banger|jam)\b/)
  if (!match) return undefined
  const words = match[1].split(/\s+/).filter((word) => !GENERIC.has(word) && !parseSoundRequests(word).length && !/^(dark|darker|happy|sad|heavy|evil|chill|angry|moody|dreamy|bright|loud|soft|epic|weird)$/.test(word))
  return words.length ? words.join(' ') : undefined
}

function capitalize(sentence: string) {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export function respondSong(input: string, song: SongSpec | undefined): SongReply {
  const text = normalize(input)
  const reply = (body: string, extra: Partial<SongReply> = {}): SongReply => ({ text: body, edits: [], unknown: false, mood: 'ready', ...extra })

  if (!text) return reply("Tell me what you want to hear and I'll write it.", { mood: 'confused' })
  if (/^(hi|hey|hello|yo|sup|hola|what's up|whats up)\b/.test(text) && text.split(' ').length <= 4) {
    return reply(song ? `Hey! "${song.title}" is loaded. Want it heavier, faster, or a whole new song?` : `Hey, I'm ${ASSISTANT_NAME}. What are we making: post punk, metal, punk, drum & bass or reggaeton?`)
  }
  if (/^(thanks|thank you|thx|ty|cheers|nice|awesome|sick|rad|love it|perfect)\b/.test(text)) return reply('🤘 Anytime. Keep it loud.')

  // "Back to synth drums" before "back" means undo.
  const removeSamples = song?.samples ? parseRemoveSamples(text) : undefined
  if (song && removeSamples) {
    const voices = (removeSamples === 'all' ? DRUM_VOICES : removeSamples).filter((voice) => song.samples?.[voice])
    if (voices.length) return reply('', { edits: voices.map((voice) => ({ type: 'set_sample', voice }) satisfies SongEdit), mood: 'ready' })
  }

  if (/^(undo|go back|back|nah|revert|previous version|take that back)\b|\bundo (that|it)\b/.test(text)) return reply('Undone. Back to the version before.', { history: 'undo' })
  if (/^redo\b/.test(text)) return reply('Redone.', { history: 'redo' })

  const look = themeReply(text)
  if (look) return reply(look.text, { theme: look.theme })

  // Vocals: presets for this song, described vocal sounds, and sending the song to the Studio.
  if (COPY_VOCAL.test(text)) {
    return reply(`🎯 Opening the Studio: upload the song you like or play it near your mic, and I'll estimate its vocal effects and save them as a preset for your voice. It's an estimate, so trust your ears.`, { studio: [{ type: 'matchReference' }] })
  }
  if (song && VOCAL_TALK.test(text) && !/\b(no|mute|remove|without)\b.*\bvocals?\b/.test(text)) {
    const toStudio = TO_STUDIO.test(text)
    const vocal = vocalPresetForSong(song, text)
    const style = getStyle(song.style)
    const missing = vocal.missing.length ? ` The Studio can't do ${vocal.missing.join(' or ')} yet, so I left that out.` : ''
    const studio: StudioAction[] = [{ type: 'genre', id: song.genreId }, { type: 'tempo', bpm: song.bpm }, vocal.action]
    const sound = vocal.words.length ? ` (${vocal.words.join(', ')})` : ''
    if (toStudio) {
      return reply(`🎤 Recording "${song.title}" into the Studio. It plays through once in real time, then the Studio opens with a ${style?.name ?? getGenre(song.genreId).name} vocal preset${sound} on your track.${missing}`, { studio, sendToStudio: true, mood: 'rocking' })
    }
    if (/\b(preset|effects?|chain|sound|reverb|delay|echo|distort|dreamy|wide|bright|dark|deep|doubled|dry|telephone|megaphone|auto ?tune|what should|how should)\b/.test(text)) {
      return reply(`Made the vocal preset "${vocal.action.name}"${sound} and saved it under Your presets in the Studio.${missing} Say "record vocals over this" to take the song there and sing.`, { studio })
    }
  }

  // Real recorded drums from Freesound.
  const sampleAsk = parseSampleRequest(text)
  const anotherSample = song?.samples && /\b(another|different|next|other)\b/.test(text) ? DRUM_VOICES.filter((voice) => song.samples?.[voice] && new RegExp(`\\b${sampleLabel(voice).split(' ').pop()}s?\\b`).test(text)) : []
  if (sampleAsk || anotherSample.length) {
    if (!song) return reply(`Let's make a song first, then I'll dig up real drums for it. Try "make a punk song".`, { mood: 'confused' })
    const voices = anotherSample.length ? anotherSample : sampleAsk!.voices
    const names = voices.map(sampleLabel).join(', ')
    return reply(`🔎 Digging through Freesound for ${anotherSample.length ? 'another ' : 'a real '}${names}…`, { samples: { voices, description: anotherSample.length ? '' : sampleAsk!.description, next: anotherSample.length > 0 }, mood: 'thinking' })
  }

  const genreAsked = findGenre(text)
  const styleAsked = findStyle(soundText(text))
  const target = findTarget(text, song)
  const soundRequests = parseSoundRequests(soundText(text))

  // Brand-new song.
  const surprise = /\b(surprise me|anything|whatever|random)\b/.test(text)
  const namesNewSong = Boolean(styleAsked || genreAsked) && /^(a |an )?([a-z0-9&' -]+ )?(song|track|beat|instrumental|tune)\b/.test(text) && !/^(make|turn|change|switch) (it|this)\b/.test(text)
  if (!song || wantsNewSong(text) || namesNewSong) {
    if (!song && !genreAsked && !styleAsked && !surprise && !wantsNewSong(text)) {
      return reply(`Let's make something. Pick a sound, like "make a metal song", "drum and bass track at 174" or "reggaeton beat in A minor", or say "surprise me".`, { unknown: true, mood: 'confused' })
    }
    const primary = GENRES.filter((genre) => genre.primary)
    const key = findKey(text)
    // "dark trap beat with a gliding 808": the words before "beat" are the style, the rest are sounds.
    const sounds = descriptions(parseSoundRequests(soundText(text).replace(/^.*?\b(song|track|beat|instrumental|tune|banger|jam)\b/, '')))
    const withSounds = sounds ? ' with the sounds you described' : ''
    if (styleAsked) {
      const at = findTempo(text)?.bpm ?? text.match(/\bat (\d{2,3})\b/)?.[1]
      const edit: SongEdit = { type: 'new_song', style: styleAsked.id, sounds, bpm: at ? Number(at) : undefined, root: key?.root, scale: key?.scale ?? darkScale(text) }
      return reply(`🤘 Fresh ${styleAsked.name} song coming up${withSounds}. Tell me what to change: "fuzzier guitars", "deeper 808", "heavier chorus", "faster".`, { edits: [edit], play: { type: 'play' }, mood: 'rocking' })
    }
    const unheard = !genreAsked && !surprise ? namedGenre(text) : undefined
    const genreId = genreAsked ?? (song && !surprise && !unheard ? song.genreId : primary[Math.floor(Math.random() * primary.length)].id)
    const edit: SongEdit = { type: 'new_song', genre: genreId, sounds, bpm: bpmInRange(genreId, text), root: key?.root, scale: key?.scale ?? darkScale(text) }
    if (unheard) {
      return reply(`I don't know "${unheard}" yet, so I started a ${getGenre(genreId).name} song${withSounds}. Describe how it should sound, like "fuzzy guitars, deep 808, roomy drums", and I'll reshape it.`, { edits: [edit], play: { type: 'play' }, unknown: true, mood: 'ready' })
    }
    return reply(`🤘 Fresh ${getGenre(genreId).name} song coming up${withSounds}. Tell me what to change: "heavier chorus", "new drums", "faster", "add a bridge".`, { edits: [edit], play: { type: 'play' }, mood: 'rocking' })
  }
  if (!song) return reply('Say "make a metal song" (or any genre) and I\'ll write one.', { unknown: true, mood: 'confused' })

  const edits: SongEdit[] = []
  let play: PlayCommand | undefined
  const said: string[] = []

  // Playback.
  if (/\b(stop|pause|silence|shut up|quiet down)\b/.test(text)) { play = { type: 'stop' }; said.push('stopped') }
  else if (/\bloop\b/.test(text)) { play = { type: 'loop', section: target?.section ?? (target?.kind ? song.sections.findIndex((section) => section.kind === target.kind) + 1 : undefined) }; said.push('looping it') }
  else if (/^(play|hit it|let's hear|lets hear|from the top|play it)\b/.test(text)) {
    const section = target?.section ?? (target?.kind ? song.sections.findIndex((section) => section.kind === target.kind) + 1 : undefined)
    play = { type: 'play', section }
    said.push(section ? 'playing from there' : 'playing from the top')
  }

  const restyle = /\b(make it|turn it|switch|change|convert|as|into|more like|sound like|in the style of)\b/.test(text)
  if (styleAsked && restyle && styleAsked.name !== song.style) {
    edits.push({ type: 'change_genre', style: styleAsked.id })
  } else if (genreAsked && restyle && (genreAsked !== song.genreId || song.style)) {
    edits.push({ type: 'change_genre', genre: genreAsked })
  }
  const restyled = edits.some((edit) => edit.type === 'change_genre')

  const feelWord = /\b(half|double)[ -]?time\b/.test(text)
  const tempo = findTempo(text)
  if (tempo && !(feelWord && tempo.bpm === undefined)) edits.push({ type: 'set_tempo', ...tempo })

  const key = findKey(text)
  if (key) edits.push({ type: 'set_key', ...key })

  const heavyWords = /\b(heavier|harder|hit harder|more aggressive|more energy|bigger|louder|angrier|more intense|crazier|go off)\b/.test(text)
  const softWords = /\b(softer|calmer|chill(er)?|less busy|quieter|mellow(er)?|smoother|relax(ed)?|tone it down|less intense|emptier)\b/.test(text)
  // "make the bass an 808", "fuzzier guitars", "roomy drums": describe the sound, Suno-style.
  const designs = restyled ? [] : soundRequests.filter((request) => {
    if (request.instrument) return true
    if (!describesSound(soundText(text)) || target) return false
    return !((heavyWords || softWords) && request.part === 'drums')
  })
  for (const request of designs) edits.push({ type: 'design_sound', part: request.part, description: request.text })
  const designed = designs.length > 0

  const tweak = designed ? undefined : findSynthTweak(text)
  // Energy words describe the song unless they were about an instrument's sound.
  const heavy = heavyWords && !(designed && !target)
  const soft = softWords && !(designed && !target)
  if (heavy) {
    edits.push({ type: 'energy', direction: 'up', ...target })
    if (/\bheavier|harder|aggressive|angrier\b/.test(text)) edits.push({ type: 'tone', tweak: 'heavier', part: 'chords' })
  } else if (soft && !tempo && !designed) {
    edits.push({ type: 'energy', direction: 'down', ...target })
  }
  if (tweak && !(heavy && tweak === 'heavier')) {
    const parts = partsIn(text).filter((part) => part !== 'drums')
    edits.push({ type: 'tone', tweak, part: parts.length === 1 ? (parts[0] as 'bass' | 'chords' | 'lead') : 'all' })
  } else if (!key && !tweak && !designed && !restyled) {
    const scale = darkScale(text)
    if (scale) edits.push({ type: 'set_key', scale })
    else if (/\b(happier|brighter|uplifting|happy|major)\b/.test(text)) edits.push({ type: 'set_key', scale: 'major' })
  }

  if (/\bhalf[ -]?time\b/.test(text)) edits.push({ type: 'feel', feel: 'half', ...target })
  else if (/\bdouble[ -]?time\b/.test(text)) edits.push({ type: 'feel', feel: 'double', ...target })
  else if (/\bnormal (time|groove|feel)\b/.test(text)) edits.push({ type: 'feel', feel: 'normal', ...target })

  const fresh = /\b(new|different|another|change( the)?|other|fresh|rewrite|redo|regenerate|swap)\b/
  if (fresh.test(text) && !/\b(add|another) (a |an )?(intro|verse|chorus|bridge|breakdown|drop|build|break|outro)\b/.test(text)) {
    if (/\b(drums?|beat|groove)\b/.test(text)) edits.push({ type: 'regenerate', what: 'drums', ...target })
    if (/\b(chords?|progression|changes)\b/.test(text)) edits.push({ type: 'regenerate', what: 'progression', ...target })
    if (/\b(melody|lead|riff|hook line)\b/.test(text)) edits.push({ type: 'regenerate', what: 'lead', ...target })
    if (/\bbass ?(line)?\b/.test(text) && !/\bsound\b/.test(text)) edits.push({ type: 'regenerate', what: 'bass', ...target })
  }
  if (/\b(surprise me|remix|shake (it )?up|randomi[sz]e|mutate|switch it up)\b/.test(text)) edits.push({ type: 'regenerate', what: 'all', ...target })

  // Arrangement.
  const add = text.match(/\b(?:add|another|one more|extra|put in|insert)\b(?: an?| one more| another)? (intro|verse|chorus|bridge|breakdown|drop|build|break|outro)/)
  if (add) edits.push({ type: 'add_section', kind: add[1] as SectionKind })
  if (/\b(remove|delete|cut|drop|lose|get rid of|skip)\b/.test(text) && target?.section !== undefined && !partsIn(text).length) edits.push({ type: 'remove_section', section: target.section })
  else if (/\b(remove|delete|cut|get rid of|skip)\b/.test(text) && target?.kind && !partsIn(text).length) {
    const last = song.sections.map((section) => section.kind).lastIndexOf(target.kind)
    if (last >= 0) edits.push({ type: 'remove_section', section: last + 1 })
  }
  if (target && /\b(longer|extend|double the length)\b/.test(text)) {
    const first = song.sections.find((section, index) => (target.section ? index === target.section - 1 : section.kind === target.kind))
    if (first) edits.push({ type: 'set_bars', bars: Math.min(32, first.bars * 2), ...target })
  } else if (target && /\b(shorter|trim|half the length)\b/.test(text)) {
    const first = song.sections.find((section, index) => (target.section ? index === target.section - 1 : section.kind === target.kind))
    if (first) edits.push({ type: 'set_bars', bars: Math.max(1, Math.floor(first.bars / 2)), ...target })
  }
  if (/\b(add|put|throw in|more)\b.*\bfills?\b/.test(text)) edits.push({ type: 'set_fill', on: true, ...target })
  else if (/\b(no|remove|without|kill)\b.*\bfills?\b/.test(text)) edits.push({ type: 'set_fill', on: false, ...target })

  for (const part of partsIn(text)) {
    if (edits.some((edit) => edit.type === 'regenerate' || edit.type === 'tone' || (edit.type === 'design_sound' && edit.part === part))) {
      if (/\b(bring in|add|put in)\b/.test(text)) edits.push({ type: 'parts', part, on: true, ...target })
      continue
    }
    if (/\b(no|mute|kill|remove|without|turn off|lose|take out|drop the)\b/.test(text)) edits.push({ type: 'parts', part, on: false, ...target })
    else if (/\b(bring back|unmute|bring in|add|turn on|with|put in)\b/.test(text) && !/\badd (a |an )?(fill|intro|verse|chorus|bridge|breakdown|drop|build|break|outro)\b/.test(text)) edits.push({ type: 'parts', part, on: true, ...target })
  }

  const rename = input.match(/\b(?:call it|name it|rename it(?: to)?|title it)\s+["“]?([^"”]{1,60})["”]?\s*$/i)
  if (rename) edits.push({ type: 'set_title', title: rename[1].trim() })

  if (edits.length || play) {
    const lead = edits.some((edit) => edit.type === 'energy' && edit.direction === 'up') ? '🤘 ' : ''
    if (!play && edits.length) play = { type: 'play', section: target?.section ?? (target?.kind ? song.sections.findIndex((section) => section.kind === target.kind) + 1 : undefined) }
    return reply(`${lead}${capitalize(said.join(', ') || 'on it')}.`, { edits, play, mood: lead ? 'rocking' : 'ready' })
  }

  if (styleAsked && styleAsked.name !== song.style) return reply(`Want me to turn "${song.title}" into ${styleAsked.name}? Say "make it ${styleAsked.name.toLowerCase()}", or "new ${styleAsked.name.toLowerCase()} song" to start fresh.`)
  if (genreAsked) return reply(`Want me to turn "${song.title}" into ${getGenre(genreAsked).name}? Say "make it ${getGenre(genreAsked).name.toLowerCase()}", or "new ${getGenre(genreAsked).name.toLowerCase()} song" to start fresh.`)
  if (/\b(what|which) (can|do) (you|i)\b|\bhelp\b|\bwhat can you do\b/.test(text)) return reply(HELP)
  return reply(`Hmm, that one's not in my setlist yet. Try "heavier chorus", "new drums in the verse", "add a bridge", "half-time breakdown", "faster", "make it darker" or "undo".`, { unknown: true, mood: 'confused' })
}

function darkScale(text: string): ScaleName | undefined {
  if (/\b(evil|sinister|scarier|creepier|demonic|haunted)\b/.test(text)) return 'phrygian'
  if (/\b(darker|sadder|moodier|gloomier|dark)\b/.test(text) && !/\b(synth|sound|tone|guitar|keys|bass sound)\b/.test(text)) return 'minor'
  return undefined
}

export const HELP = `I write whole songs and change them when you ask. Try:
• "make a post punk song" or "drum and bass at 174 in F minor"
• "heavier chorus", "chill the verse out", "half-time bridge"
• "new drums", "new chords for the chorus", "new melody"
• "add a breakdown", "cut the last chorus", "make the intro longer"
• "faster", "key of D minor", "make it darker", "brighter synth"
• Any style: "shoegaze song with fuzzy wide guitars", "trap beat with a deep gliding 808", "make it synthwave"
• Any sound: "make the bass an 808", "piano chords", "glassy bells for the melody", "roomy live drums"
• "play the chorus", "loop the bridge", "stop", "undo"
• Vocals: "vocal preset for this song", "dreamy vocals with lots of reverb", "record vocals over this"`

/** Summary line used after edits, e.g. "Made every chorus heavier and set the tempo to 160 BPM." */
export function describeOutcome(summaries: string[], errors: string[]): string {
  const done = summaries.length ? `${capitalize(summaries.join(', '))}.` : ''
  const failed = errors.length ? ` Couldn't do everything: ${errors.join('; ')}.` : ''
  return (done + failed).trim()
}

export function genreButtons(): { id: string; label: string; prompt: string }[] {
  return GENRES.filter((genre) => genre.primary).map((genre) => ({ id: genre.id, label: genre.name, prompt: `Make a ${genre.name.toLowerCase()} song` }))
}
