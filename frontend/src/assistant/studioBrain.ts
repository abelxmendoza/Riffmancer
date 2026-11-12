import { getGenre } from '../beatmaker/genres'
import { defaultPresetFor, getVocalPreset, presetsForGenre } from '../studio/presets'
import { describeVocal, vocalName } from '../studio/vocalSound'
import type { StudioAction } from './bus'
import { findGenre, findTempo, type EngineContext, type Reply } from './engine'

type StudioReply = Pick<Reply, 'text'> & Partial<Reply>

const STUDIO_WORDS = /\b(studio|vocals?|voice|sing(ing)?|mic|microphone|takes?|acapella|a cappella|preset)\b/

const ANSWERS: [RegExp, string][] = [
  [/\blatency\b|\bout of (time|sync)\b|\b(late|early|behind|ahead)\b|\boff ?beat\b|\bdrag(ging)?\b/, 'If your takes land late, open Settings in the Studio transport and raise "Latency fix" until a clap on the beat lines up with the grid. Bluetooth headphones add 150–250 ms, so wired headphones make life much easier.'],
  [/\bheadphones?\b|\bfeedback\b|\bbleed\b|\becho(es)? of the beat\b/, 'Wear headphones while recording, otherwise the mic picks up the instrumental and you get echoes and feedback. Wired is best: Bluetooth adds a lot of delay.'],
  [/\bhow\b.*\brecord\b|\brecord(ing)? (my )?vocals?\b|\bget started\b/, 'Import your instrumental, check the lead track has the red ● armed, put on headphones and hit Record. You get a one-bar count-in, then sing. Hit Stop when done. Record again at the same spot and the new take stacks on top; pick your favourite from the take list.'],
  [/\btakes?\b|\bcomp(ing)?\b/, 'Every time you record over the same spot, the new take stacks into the same clip. Click a clip to see its takes, audition each one, and keep the best. Turn on Loop to record take after take without stopping; each pass becomes its own take.'],
  [/\bauto ?tune\b|\bpitch (correction|fix)\b|\bmelodyne\b/, 'Pitch correction isn\'t in the Studio yet; it\'s next on the roadmap along with take comping. For now the presets handle tone, space and polish.'],
  [/\bstems?\b|\bexport\b|\bbounce\b|\bmix ?down\b|\bdownload\b/, '"Export mix" renders the whole song through the master bus as a WAV. "Export stems" gives a zip with every track on its own, effects included, plus an all-vocals file, ready for another DAW or a mixing engineer.'],
  [/\b(import|suno|instrumental|beat from)\b/, 'Hit "Import instrumental" and pick an MP3 or WAV (Suno exports work great). You can import several stems as separate tracks too, or send a take straight from the Beat Maker with "Send to Studio".'],
  [/\bpresets?\b|\bwhich (sound|effect)s?\b|\bvocal chain\b/, ''],
]

const PRESET_WORDS: [RegExp, string][] = [
  [/\bguttural\b|\bgrowl\b|\bdeathcore\b|\bdeath metal\b/, 'metal-guttural'],
  [/\bscream\b|\bfry\b|\bscreams\b/, 'metal-scream'],
  [/\btelephone\b|\bphone\b|\blo-?fi\b/, 'telephone'],
  [/\bmegaphone\b|\bbullhorn\b/, 'megaphone'],
  [/\bgang\b|\bcrowd\b/, 'punk-gang'],
  [/\b(delay )?throws?\b/, 'reggaeton-throw'],
  [/\bliquid\b|\bdiva\b/, 'dnb-liquid'],
  [/\bmc\b|\bhype\b|\bspitting\b/, 'dnb-mc'],
  [/\bbaritone\b|\bdeep\b/, 'post-punk-baritone'],
  [/\bharmon(y|ies)\b/, 'harmony-pad'],
  [/\bnatural\b|\bno effects\b|\bplain\b/, 'natural'],
]

const ROLE_WORDS: [RegExp, Extract<StudioAction, { type: 'addTrack' }>['role']][] = [
  [/\bdoubles?\b/, 'double'],
  [/\bharmon(y|ies)\b/, 'harmony'],
  [/\bad-?libs?\b/, 'ad-lib'],
  [/\bscreams?\b/, 'scream'],
  [/\bgang\b/, 'gang'],
  [/\bfx\b|\beffects?\b/, 'fx'],
]

/**
 * "make my vocals dreamy with lots of reverb" → a new vocal preset built from those words, on top
 * of the genre's usual lead sound. Returns nothing when no sound words were understood.
 */
export function describedVocalAction(text: string, genre: string): { action: Extract<StudioAction, { type: 'customPreset' }>; text: string } | undefined {
  const described = describeVocal(text, defaultPresetFor(genre).chain)
  if (!described.words.length) {
    return undefined
  }
  const name = vocalName(described.words)
  const missing = described.missing.length ? ` The Studio can't do ${described.missing.join(' or ')} yet, so I left that out.` : ''
  return {
    action: { type: 'customPreset', name, chain: described.chain, description: `Made from: "${text.slice(0, 80)}"` },
    text: `Made a "${name}" preset (${described.words.join(', ')}) and saved it under Your presets.${missing} Every knob stays editable.`,
  }
}

const SAVE_PRESET = /\bsave (this|it|that|the (current )?(sound|chain|effects?)) as (a |my )?(new )?preset(?: called| named)?\s*["“]?([^"”]*)["”]?$/

const isQuestion = (text: string) => /\?$|^(how|what|why|where|when|can|does|do|is|which|who)\b/.test(text)

/** Studio part of Fret's built-in brain. Returns nothing when the message isn't about the Studio. */
export function respondStudio(text: string, context: EngineContext): StudioReply | undefined {
  const onStudio = context.route === 'studio'
  const aboutStudio = STUDIO_WORDS.test(text)

  if (/\b(go|take me|open|show|switch)\b.*\b(studio|vocal booth)\b/.test(text) && !onStudio) {
    return { text: 'Opening the Studio. Import your instrumental, arm a vocal track and hit Record.', navigate: 'studio' }
  }
  if (!onStudio && /\b(record|track|cut) (my |some )?vocals\b/.test(text)) {
    return { text: 'Vocals happen in the Studio. Opening it now: import your instrumental, put on headphones and hit Record.', navigate: 'studio' }
  }
  if (!onStudio && !aboutStudio) return undefined

  // Described vocal sounds work from any page: the preset waits for the Studio to open.
  if (!isQuestion(text) && /\b(vocals?|voice|preset|singing)\b/.test(text) && !PRESET_WORDS.some(([pattern]) => pattern.test(text))) {
    const described = describedVocalAction(text, context.studio?.genre ?? 'post-punk')
    if (described) return { text: described.text, studioActions: [described.action], navigate: onStudio ? undefined : 'studio', mood: 'ready' }
  }
  const save = text.match(SAVE_PRESET)
  if (save && onStudio) {
    const name = (save[6]?.trim() || 'my vocal').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    return { text: `Saved the selected track's effects as "${name}" under Your presets.`, studioActions: [{ type: 'savePreset', name }] }
  }

  if (isQuestion(text)) {
    for (const [pattern, answer] of ANSWERS) {
      if (!pattern.test(text)) continue
      if (answer) return { text: answer }
      const genre = context.studio?.genre ?? 'post-punk'
      const list = presetsForGenre(genre).map((preset) => `${preset.name} (${preset.description.split(':')[0].replace(/\.$/, '')})`).join('; ')
      return { text: `Vocal presets for ${getGenre(genre).name}: ${list}. Say "use the scream preset" or pick one on the track. Every knob stays editable.` }
    }
    return undefined
  }
  if (!onStudio) return undefined
  // A beat request on the Studio page belongs to the Beat Maker.
  if (/\bbeats?\b/.test(text) && findGenre(text)) return undefined

  const actions: StudioAction[] = []
  const said: string[] = []

  const addsTrack = /\b(add|new|another|create)\b.*\btracks?\b|\badd (a |an |another )?(doubles?|harmon(y|ies)|ad-?libs?|screams?|gang|lead|vocal)\b/.test(text)
  if (addsTrack) {
    const role = ROLE_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'lead'
    actions.push({ type: 'addTrack', role })
    said.push(`added a ${role === 'lead' ? 'vocal' : role} track`)
  }

  const genre = findGenre(text)
  if (genre && !addsTrack) {
    actions.push({ type: 'genre', id: genre })
    said.push(`switched the vocal presets and master to ${getGenre(genre).name}`)
  }

  if (!addsTrack && /\b(preset|use|give|make|switch|set|sound|voice|vocals?|try)\b/.test(text)) {
    const preset = PRESET_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? (/\bclean\b/.test(text) && /\bmetal\b/.test(text) ? 'metal-clean' : undefined)
    if (preset) {
      actions.push({ type: 'preset', id: preset })
      said.push(`put ${getVocalPreset(preset).name} on the selected track`)
    }
  }

  if (/\b(export|bounce|mix ?down|render)\b|\bdownload\b/.test(text)) {
    const what = /\bstems?\b|\bacapella\b|\bseparate\b/.test(text) ? 'stems' : 'mix'
    actions.push({ type: 'export', what })
    said.push(what === 'stems' ? 'exporting the stems' : 'exporting the mix')
  }

  const off = /\b(off|no|kill|mute|without|stop|disable|lose)\b/
  if (/\b(click|metronome)\b/.test(text)) {
    const on = !off.test(text)
    actions.push({ type: 'metronome', on })
    said.push(on ? 'click is on' : 'click is off')
  }
  if (/\bcount[- ]?in\b/.test(text)) {
    const bars = off.test(text) ? 0 : Number(text.match(/\b([1-4])\b/)?.[1] ?? (/\b(two|2)\b/.test(text) ? 2 : 1))
    actions.push({ type: 'countIn', bars })
    said.push(bars ? `count-in set to ${bars} bar${bars > 1 ? 's' : ''}` : 'count-in is off')
  }
  if (/\b(loop|cycle)\b/.test(text)) {
    const on = !off.test(text)
    actions.push({ type: 'loop', on })
    said.push(on ? 'loop recording is on, each pass becomes a take' : 'loop is off')
  }

  const tempo = findTempo(text)
  if (tempo) {
    actions.push({ type: 'tempo', ...tempo })
    said.push(tempo.bpm ? `project tempo set to ${tempo.bpm} BPM` : 'nudged the project tempo')
  }

  if (/\b(import|load|bring in|upload|open)\b.*\b(beat|instrumental|track|song|suno|file|mp3|wav)\b/.test(text)) {
    actions.push({ type: 'import' })
    said.push('pick your instrumental file')
  }

  const stopRecording = /\bstop recording\b|\bthat's (it|the take)\b/.test(text)
  const startRecording = !stopRecording && /\b(start )?record(ing)?\b|\b(cut|lay down|do) (a |another )?take\b|\bpunch in\b|\blet me sing\b/.test(text)
  if (stopRecording) { actions.push({ type: 'record', on: false }); said.push('stopped recording, your take is on the track') }
  else if (startRecording) { actions.push({ type: 'record', on: true }); said.push('recording after the count-in, sing it') }
  else if (/\b(stop|pause)\b/.test(text) && !actions.some((action) => action.type === 'metronome' || action.type === 'loop')) { actions.push({ type: 'stop' }); said.push('stopped') }
  else if (/\b(play|listen|playback|hear it|let's hear)\b/.test(text)) { actions.push({ type: 'play' }); said.push('playing') }

  if (!actions.length) return undefined
  const sentence = said.join(', ')
  const tip = actions.find((action): action is Extract<StudioAction, { type: 'preset' }> => action.type === 'preset')
  return {
    text: `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${tip ? ` ${getVocalPreset(tip.id).tip}` : ''}`,
    studioActions: actions,
    mood: actions.some((action) => action.type === 'record' && action.on) ? 'rocking' : 'ready',
  }
}
