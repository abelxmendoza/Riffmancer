import { GENRES, getGenre } from '../beatmaker/genres'
import { NOTE_NAMES, SCALE_LABELS, type ScaleName } from '../beatmaker/theory'
import type { Route } from '../lib/route'
import type { BeatAction, BeatStatus, SynthTweak } from './bus'
import { ASSISTANT_NAME } from './persona'

export type Mood = 'idle' | 'listening' | 'thinking' | 'ready' | 'rocking' | 'confused'

export interface Reply {
  text: string
  /** Changes for the Beat Maker. */
  actions: BeatAction[]
  /** A page to open. */
  navigate?: Route
  /** True when the built-in brain didn't understand; the live model may take over. */
  unknown: boolean
  mood: Mood
}

export interface EngineContext {
  route: Route
  beat: BeatStatus
}

const GENRE_ALIASES: [RegExp, string][] = [
  [/\bpost[\s-]?punk\b|\bgoth\b|\bcold ?wave\b|\bdark ?wave\b|\bjoy division\b/, 'post-punk'],
  [/\bdrum (?:and|&|n) bass\b|\bdnb\b|\bd&b\b|\bjungle\b|\bliquid\b|\bneurofunk\b/, 'drum-and-bass'],
  [/\breggaet[oó]n\b|\bdembow\b|\bperreo\b|\blatin\b/, 'reggaeton'],
  [/\bboom ?bap\b|\bhip ?hop\b|\brap\b/, 'boom-bap'],
  [/\bhouse\b|\bedm\b|\bdance\b|\btechno\b/, 'house'],
  [/\bmetal\b|\bthrash\b|\bdjent\b|\bmetalcore\b|\bheavy\b|\bdoom\b|\bbreakdown\b/, 'metal'],
  [/\bpunk\b|\bskate\b|\bhardcore\b|\bpop[\s-]?punk\b/, 'punk'],
]

const NOTE_LOOKUP: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

function normalize(text: string) {
  return text.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9#&'\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function findGenre(text: string): string | undefined {
  // "post punk" must win over "punk", so aliases are checked in order and post punk first.
  for (const [pattern, id] of GENRE_ALIASES) if (pattern.test(text)) return id
  return undefined
}

export function findKey(text: string): { root?: number; scale?: ScaleName } | undefined {
  const match = text.match(/\b(?:key of|in the key of|in|key)\s+([a-g])\s*(#|sharp|b|flat)?\s*(major|minor|maj|min|m)?\b/)
  if (!match) return undefined
  const [, letter, accidental, quality] = match
  // "in a" alone is too ambiguous ("in a minute"); require an accidental, a quality or the word "key".
  if (!accidental && !quality && !/\bkey\b/.test(text)) return undefined
  let root = NOTE_LOOKUP[letter]
  if (accidental === '#' || accidental === 'sharp') root = (root + 1) % 12
  if (accidental === 'b' || accidental === 'flat') root = (root + 11) % 12
  const scale: ScaleName | undefined = quality === 'major' || quality === 'maj' ? 'major' : quality ? 'minor' : undefined
  return { root, scale }
}

function findTempo(text: string): { bpm?: number; delta?: number } | undefined {
  const exact = text.match(/\b(\d{2,3})\s*(?:bpm|beats per minute)\b/) ?? (/\b(tempo|speed|bpm)\b/.test(text) ? text.match(/\b(\d{2,3})\b/) : null)
  if (exact) return { bpm: Number(exact[1]) }
  if (/\b(a lot|way|much) faster\b|\bdouble time\b/.test(text)) return { delta: 25 }
  if (/\b(a lot|way|much) slower\b|\bhalf time\b/.test(text)) return { delta: -25 }
  if (/\b(faster|speed (it )?up|quicker|more energy)\b/.test(text)) return { delta: 10 }
  if (/\b(slower|slow (it )?down|chill(er)?)\b/.test(text)) return { delta: -10 }
  return undefined
}

function findSynthTweak(text: string): SynthTweak | undefined {
  if (!/\b(synth|sound|lead|tone|guitar|keys)\b/.test(text)) return undefined
  if (/\b(darker|warmer|duller|muffled)\b/.test(text)) return 'darker'
  if (/\b(brighter|sharper|crisper)\b/.test(text)) return 'brighter'
  if (/\b(heavier|dirtier|distort(ed|ion)?|crunch(y|ier)?|gnarl(y|ier))\b/.test(text)) return 'heavier'
  if (/\b(cleaner|clean)\b/.test(text)) return 'cleaner'
  if (/\b(reverb|spac(e|ier|ey)|echo|bigger|wetter)\b/.test(text)) return 'spacier'
  if (/\b(drier|dry|tighter)\b/.test(text)) return 'drier'
  if (/\b(chorus|wider|shimmer)\b/.test(text)) return 'wider'
  return undefined
}

const TWEAK_TEXT: Record<SynthTweak, string> = {
  darker: 'darker and warmer',
  brighter: 'brighter',
  heavier: 'way dirtier (more drive)',
  cleaner: 'clean',
  spacier: 'huge with more space and echo',
  drier: 'tight and dry',
  wider: 'wide and shimmery (more chorus)',
}

const PART_WORDS: [RegExp, 'drums' | 'bass' | 'chords'][] = [[/\bdrums?\b|\bbeat\b/, 'drums'], [/\bbass\b/, 'bass'], [/\bchords?\b|\bguitars?\b|\bpads?\b/, 'chords']]

/** Questions with fixed answers. Checked before commands only when the message is clearly a question. */
const ANSWERS: [RegExp, string][] = [
  [/\b(midi|plug (it )?in|connect).*\b(keyboard|controller)?|\bkeyboard (not|isn't|won't) work/, 'Plug your MIDI keyboard in with USB (or pair it over Bluetooth), open Riffmancer in Chrome or Edge, and click Allow when the browser asks about MIDI. The dot next to "Play your keyboard" turns green when I can hear it. Safari can\'t do MIDI, but your computer keys work everywhere: 1–8 drums, Z–M chords, A to \' synth, Space to play.'],
  [/\b(play|do|make|use) chords?\b|\bhow.*chords?\b/, 'Easy mode: in Band mode, every white key left of the split (C4 by default) is a whole chord that fits the song. Hit one and the bass and drums follow it. You can\'t pick a wrong one. On a computer keyboard, Z X C V B N M are chords 1 to 7.'],
  [/\bwrong notes?\b|\bscale lock\b|\bout of key\b/, '"No wrong notes" snaps every synth key to the nearest note in the song\'s key, so even random mashing sounds musical. Turn it off in the keyboard panel if you want every note exactly as pressed.'],
  [/\bcapture\b|\brecord (my|the) (drums|beat|hits)\b/, 'Turn on Capture, press play, and finger-drum on the pads. Every hit lands in the drum grid at the nearest step, and chords you play get written into the progression. Turn it off when you like the loop.'],
  [/\b(download|export|save).*(song|beat|track|audio|take)\b|\brecord(ing)? audio\b/, 'Hit "● Record audio", jam, then hit stop. A "Download take" button appears with your audio file. Your beat settings also save automatically in the browser.'],
  [/\bdrum pads?\b|\bfinger drum/, 'The pads on the right (or keys 1–8) play drums any time. Switch the keyboard to "Drum pads" to turn every key into a drum. Pad controllers on MIDI channel 10 always play drums.'],
  [/\bwhat('s| is) (a )?(bpm|tempo)\b/, 'BPM is beats per minute, the speed of the song. Reggaeton sits around 95, punk around 180, drum & bass at 174. Say "faster", "slower" or "tempo 160".'],
  [/\bwhat('s| is) swing\b/, 'Swing delays every other 16th note a little so the groove bounces instead of marching. Hip hop loves it; metal and punk usually keep it at zero.'],
  [/\bwhat('s| is) (a )?chord\b/, 'A chord is a few notes played together. Here one key gives you the whole chord, already in key, so you just pick which one feels right.'],
  [/\bwhat('s| is) (a )?(key|scale)\b|\bwhat('s| is) (a )?mood\b/, 'The key is the home note of the song, and the scale (the "Mood" menu) is the set of notes that sound right with it. Minor feels dark, major feels bright, phrygian feels evil. Try "key of A minor" or "make it darker".'],
  [/\bsynth(esizer)?\b.*\b(how|what|work|use)\b|\b(how|what)\b.*\bsynth(esizer)?\b/, 'The Synthesizer panel shapes three sounds: your melody, the chords and the bass. Pick a preset, then play with Brightness (dark to bright), Pluck (the "wah" at the start), Drive (distortion), Chorus, Echo and Space. Or just tell me "make the synth heavier".'],
  [/\bstem ?lab\b|\bstems?\b|\bsplit (a )?song\b/, 'The Stem Lab splits a finished song into vocals, drums, bass and everything else so a band can rehearse it. It needs the local Riffmancer server running. Say "open the stem lab" to go there.'],
  [/\bwhat genres\b|\bwhich genres\b|\blist (the )?genres\b|\bgenres\?/, `I can play ${GENRES.filter((genre) => genre.primary).map((genre) => genre.name).join(', ')}, plus ${GENRES.filter((genre) => !genre.primary).map((genre) => genre.name).join(' and ')}. Just say one, like "make it reggaeton".`],
  [/\bwho are you\b|\bwhat are you\b|\byour name\b/, `I'm ${ASSISTANT_NAME}, Riffmancer's roadie. Bone head, headstock hair, piano-key teeth. I set up the band, explain the buttons, and keep you out of music-theory homework.`],
  [/\bwhat (is|does) riffmancer\b|\bwhat can (you|i) do\b|\bhelp\b|\bhow (does this|do i start|does it work)\b/, `Pick a genre, press play, and the band starts. Left side of your keyboard picks chords (the band follows), right side plays the synth, and every note fits. Ask me things like "make a punk beat at 190", "add a fill", "switch to beat B", "make the synth darker", "no bass" or "start recording".`],
]

const isQuestion = (text: string) => /\?$|^(how|what|why|where|when|can|does|do|is|which|who)\b/.test(text)

function genreDescription(id: string) {
  const genre = getGenre(id)
  return `${genre.name}: ${genre.tagline} ${genre.tips[0] ?? ''}`.trim()
}

/**
 * Riffmancer's built-in brain. Understands requests offline and turns them into Beat Maker actions,
 * so the mascot works with no server and no AI key.
 */
export function respond(input: string, context: EngineContext): Reply {
  const text = normalize(input)
  const reply = (body: string, extra: Partial<Reply> = {}): Reply => ({ text: body, actions: [], unknown: false, mood: 'ready', ...extra })

  if (!text) return reply('Say something and I\'ll make some noise.', { mood: 'confused' })
  if (/^(hi|hey|hello|yo|sup|hola|what's up|whats up)\b/.test(text) && text.split(' ').length <= 4) {
    return reply(`Hey! I'm ${ASSISTANT_NAME}. What are we making today: post punk, metal, punk, drum & bass or reggaeton?`)
  }
  if (/^(thanks|thank you|thx|ty|cheers|nice|awesome|sick|rad)\b/.test(text)) return reply('🤘 Anytime. Keep it loud.')

  const genreAsked = findGenre(text)
  if (genreAsked && /\b(what is|what's|tell me about|describe|explain)\b/.test(text)) return reply(genreDescription(genreAsked))

  if (isQuestion(text)) {
    for (const [pattern, answer] of ANSWERS) if (pattern.test(text)) return reply(answer)
  }

  // Navigation.
  if (/\b(go|take me|open|show|switch)\b.*\bstem ?lab\b/.test(text)) return reply('Opening the Stem Lab.', { navigate: 'stems' })
  if (/\b(go|take me|back)\b.*\bhome\b|\blanding page\b/.test(text)) return reply('Heading home.', { navigate: 'home' })
  const wantsBeatMaker = /\b(go|take me|open|show)\b.*\b(beat ?maker|studio)\b/.test(text)

  const actions: BeatAction[] = []
  const said: string[] = []

  if (genreAsked && genreAsked !== context.beat.genreId) {
    actions.push({ type: 'genre', id: genreAsked })
    said.push(`loaded ${getGenre(genreAsked).name}`)
  } else if (genreAsked) {
    said.push(`we're already in ${getGenre(genreAsked).name}`)
  }

  const tempo = findTempo(text)
  if (tempo?.bpm !== undefined) {
    const bpm = Math.max(60, Math.min(240, tempo.bpm))
    actions.push({ type: 'tempo', bpm })
    said.push(`tempo set to ${bpm} BPM`)
  } else if (tempo?.delta) {
    actions.push({ type: 'tempo', delta: tempo.delta })
    said.push(tempo.delta > 0 ? `sped up ${tempo.delta} BPM` : `slowed down ${-tempo.delta} BPM`)
  }

  const key = findKey(text)
  if (key) {
    actions.push({ type: 'key', ...key })
    said.push(`key set to ${key.root !== undefined ? NOTE_NAMES[key.root] : ''}${key.scale ? ` ${key.scale}` : ''}`.trim())
  }

  const tweak = findSynthTweak(text)
  if (tweak) {
    actions.push({ type: 'synth', tweak })
    said.push(`made the synth ${TWEAK_TEXT[tweak]}`)
  } else if (!key) {
    if (/\b(darker|sadder|evil|sinister|scarier|creepier)\b/.test(text)) {
      const scale: ScaleName = /\b(evil|sinister|scarier|creepier)\b/.test(text) ? 'phrygian' : 'minor'
      actions.push({ type: 'key', scale })
      said.push(`switched the mood to ${SCALE_LABELS[scale].toLowerCase()}`)
    } else if (/\b(happier|brighter|uplifting|happy)\b/.test(text)) {
      actions.push({ type: 'key', scale: 'major' })
      said.push('switched the mood to major (bright)')
    }
  }

  if (/\b(fill|drum roll|roll)\b/.test(text)) { actions.push({ type: 'fill' }); said.push('a fill is coming on the next bar') }
  if (/\bbeat b\b|\balt(ernate)? beat\b|\bother beat\b/.test(text)) { actions.push({ type: 'variation', which: 'alt' }); said.push('switched to beat B') }
  else if (/\bbeat a\b|\bmain beat\b/.test(text)) { actions.push({ type: 'variation', which: 'main' }); said.push('back to beat A') }
  else if (/\b(switch|change) (the )?(beat|groove)\b/.test(text)) { actions.push({ type: 'variation', which: 'toggle' }); said.push('flipped to the other groove') }
  if (/\b(mutate|surprise me|remix|shake (it )?up|randomi[sz]e|variation)\b/.test(text)) { actions.push({ type: 'mutate' }); said.push('mutated the drums') }
  if (/\b(reset|start over|default)\b/.test(text)) { actions.push({ type: 'reset' }); said.push('reset to the genre preset') }

  for (const [pattern, part] of PART_WORDS) {
    if (!pattern.test(text)) continue
    if (/\b(no|mute|drop|kill|remove|without|turn off|lose)\b/.test(text)) { actions.push({ type: 'part', part, on: false }); said.push(`muted the ${part}`) }
    else if (/\b(bring back|unmute|add|turn on|with)\b/.test(text) && !/\badd (a )?fill\b/.test(text)) { actions.push({ type: 'part', part, on: true }); said.push(`${part} are back`) }
  }

  if (/\bdrum pads? mode\b|\bkeys? (as|are) drums\b|\bevery key (a|is a) drum\b/.test(text)) { actions.push({ type: 'keyboardMode', mode: 'drums' }); said.push('every key is a drum now') }
  else if (/\bsynth only\b|\bmelody mode\b/.test(text)) { actions.push({ type: 'keyboardMode', mode: 'synth' }); said.push('every key plays the synth now') }
  else if (/\bband mode\b/.test(text)) { actions.push({ type: 'keyboardMode', mode: 'band' }); said.push('back to Band mode') }

  if (/\b(start|begin) recording\b|^record\b|\brecord (a take|this|it)\b/.test(text)) { actions.push({ type: 'record', on: true }); said.push('recording') }
  else if (/\bstop recording\b/.test(text)) { actions.push({ type: 'record', on: false }); said.push('stopped recording; grab your take from "Download take"') }

  const wantsStop = /\b(stop|pause|silence|shut up|quiet)\b/.test(text) && !/\bstop recording\b/.test(text)
  const wantsPlay = /\b(play|start|go|hit it|drop it|jam|let's go|lets go|rock|make (a|me a|some)? ?(beat|song|track|instrumental))\b/.test(text) && !wantsStop
  if (wantsStop) { actions.push({ type: 'stop' }); said.push('band stopped') }
  else if (wantsPlay && !context.beat.playing) { actions.push({ type: 'play' }); said.push('band is playing') }
  else if (genreAsked && !context.beat.playing && !wantsStop) { actions.push({ type: 'play' }); said.push('band is playing') }

  const needsBeatMaker = actions.length > 0 && context.route !== 'beats'
  if (actions.length) {
    const sentence = said.join(', ')
    const lead = actions.some((action) => action.type === 'genre') ? '🤘 ' : ''
    const tip = actions.find((action) => action.type === 'genre') ? ` ${getGenre((actions.find((action) => action.type === 'genre') as { id: string }).id).tips[0]}` : ''
    return reply(`${lead}${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${tip}`, { actions, navigate: needsBeatMaker ? 'beats' : undefined, mood: actions.some((action) => action.type === 'play') ? 'rocking' : 'ready' })
  }
  if (wantsBeatMaker) return reply('Opening the Beat Maker. Pick a genre and hit play.', { navigate: 'beats' })
  if (genreAsked) return reply(genreDescription(genreAsked))

  for (const [pattern, answer] of ANSWERS) if (pattern.test(text)) return reply(answer)

  return reply(`Hmm, that one's not in my setlist. Try "make a metal beat", "faster", "add a fill", "key of D minor", "make the synth darker", or ask "how do I play chords?".`, { unknown: true, mood: 'confused' })
}

/** Suggestion chips that fit the page the player is on. */
export function chipsFor(route: Route, beat: BeatStatus): string[] {
  if (route === 'beats') {
    return [
      beat.playing ? 'Add a fill' : 'Play',
      beat.playing ? 'Faster' : 'Make a metal beat',
      'Switch to beat B',
      'Make the synth heavier',
      'How do I play chords?',
      beat.playing ? 'Stop' : 'Surprise me',
    ]
  }
  if (route === 'stems') return ['What is the Stem Lab?', 'Take me to the Beat Maker', 'Make a punk beat']
  return ['Make a post punk beat', 'What genres can you play?', 'How do I connect my MIDI keyboard?', 'What can you do?']
}
