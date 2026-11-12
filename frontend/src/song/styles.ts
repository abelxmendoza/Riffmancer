import type { ScaleName } from '../beatmaker/theory'
import type { SoundPart } from './sound'

/**
 * Styles: any genre a person might type, built on one of the seven song engines plus a tempo,
 * a mood and plain-word sound descriptions. Adding a style is one entry here, no audio code.
 * Order matters: more specific names come first ("pop punk" before "punk").
 */
export interface Style {
  id: string
  name: string
  /** The song engine (genre file) whose grooves and song shapes it uses. */
  genre: string
  aliases: RegExp
  bpm: number
  scale: ScaleName
  root?: number
  swing?: number
  /** Drum feel for the whole song. */
  feel?: 'half' | 'double'
  /** How each part should sound, in the same words a person would type. */
  sounds: Partial<Record<SoundPart, string>>
}

export const STYLES: Style[] = [
  // Post punk family.
  { id: 'shoegaze', name: 'Shoegaze', genre: 'post-punk', aliases: /\bshoe ?gaze\b|\bdream ?gaze\b|\bmy bloody valentine\b/, bpm: 120, scale: 'major', sounds: { chords: 'wall of fuzz guitars, wide, dreamy, washed out', lead: 'dreamy wide pad lead, long', bass: 'warm bass guitar', drums: 'roomy live drums, soft' } },
  { id: 'darkwave', name: 'Darkwave', genre: 'post-punk', aliases: /\bdark ?wave\b|\bcold ?wave\b|\bminimal wave\b/, bpm: 128, scale: 'minor', sounds: { bass: 'synth bass, punchy, dark', chords: 'dark pad, wide', lead: 'cold saw lead, echoey', drums: 'drum machine, dry, punchy' } },
  { id: 'goth-rock', name: 'Goth rock', genre: 'post-punk', aliases: /\bgoth(ic)? rock\b|\bdeath ?rock\b|\bgoth\b|\bsisters of mercy\b/, bpm: 135, scale: 'minor', sounds: { chords: 'chorused clean guitars, spacey, dark', bass: 'bass guitar, punchy, bright', lead: 'echoey clean guitar lead', drums: 'drum machine, roomy' } },
  { id: 'new-wave', name: 'New wave', genre: 'post-punk', aliases: /\bnew ?wave\b|\b80s pop\b|\beighties\b/, bpm: 132, scale: 'major', sounds: { chords: 'synth stabs, bright', bass: 'synth bass, plucky', lead: 'square lead, bright', drums: 'drum machine, punchy, roomy' } },
  { id: 'synthwave', name: 'Synthwave', genre: 'post-punk', aliases: /\bsynth ?wave\b|\boutrun\b|\bretro ?wave\b|\bvaporwave\b/, bpm: 110, scale: 'minor', sounds: { chords: 'lush pad, wide, long', bass: 'synth bass, plucky, punchy', lead: 'supersaw lead, echoey, wide', drums: 'drum machine, roomy, punchy' } },
  { id: 'ebm', name: 'EBM / industrial', genre: 'post-punk', aliases: /\bebm\b|\bindustrial\b|\baggrotech\b|\bnine inch nails\b/, bpm: 124, scale: 'phrygian', sounds: { bass: 'synth bass, distorted, plucky', chords: 'synth stabs, distorted, dark', lead: 'resonant saw lead, distorted', drums: 'drum machine, distorted, dry, punchy' } },
  { id: 'indie-rock', name: 'Indie rock', genre: 'post-punk', aliases: /\bindie( rock)?\b|\balt(ernative)? rock\b|\bgarage rock\b/, bpm: 138, scale: 'major', sounds: { chords: 'jangly guitars, bright', bass: 'bass guitar', lead: 'clean guitar lead', drums: 'live drums, roomy' } },
  { id: 'surf-rock', name: 'Surf rock', genre: 'post-punk', aliases: /\bsurf( rock)?\b|\btwang\b/, bpm: 160, scale: 'mixolydian', sounds: { chords: 'twangy guitars, echoey, roomy', bass: 'bass guitar, round', lead: 'twangy guitar solo, echoey, clean', drums: 'live drums, roomy' } },
  { id: 'grunge', name: 'Grunge', genre: 'post-punk', aliases: /\bgrunge\b|\bnirvana\b|\bseattle\b/, bpm: 118, scale: 'minor', sounds: { chords: 'fuzzy guitars, heavy, raw', bass: 'fuzz bass', lead: 'distorted guitar solo, raw', drums: 'live drums, roomy, punchy' } },
  { id: 'emo', name: 'Midwest emo', genre: 'post-punk', aliases: /\bmidwest emo\b|\bemo\b|\bmath rock\b/, bpm: 150, scale: 'major', sounds: { chords: 'clean guitars, bright, plucky', bass: 'bass guitar', lead: 'twinkly clean guitar lead, bright', drums: 'live drums, roomy' } },

  // Metal family.
  { id: 'black-metal', name: 'Black metal', genre: 'metal', aliases: /\bblack ?metal\b|\bblackgaze\b/, bpm: 185, scale: 'minor', feel: 'double', sounds: { chords: 'distorted guitars, thin, trashy, washed out', bass: 'fuzz bass, thin', lead: 'distorted guitar solo, spacey', drums: 'live drums, trashy, roomy' } },
  { id: 'death-metal', name: 'Death metal', genre: 'metal', aliases: /\bdeath ?metal\b|\bdeathcore\b|\bslam\b/, bpm: 190, scale: 'phrygian', root: 2, sounds: { chords: 'heavy distorted guitars, dark, low, tight', bass: 'distorted bass, dark', lead: 'guitar solo, distorted', drums: 'live drums, dry, punchy' } },
  { id: 'doom', name: 'Doom / sludge', genre: 'metal', aliases: /\bdoom( metal)?\b|\bsludge\b|\bstoner( rock| metal)?\b|\bblack sabbath\b/, bpm: 70, scale: 'phrygian', root: 2, feel: 'half', sounds: { chords: 'fuzz guitars, huge, dark, long', bass: 'fuzz bass, low, fat', lead: 'fuzzy guitar solo, gliding', drums: 'live drums, roomy, fat' } },
  { id: 'djent', name: 'Djent', genre: 'metal', aliases: /\bdjent\b|\bprog(ressive)? metal\b|\bmeshuggah\b/, bpm: 128, scale: 'phrygian', root: 6, sounds: { chords: 'heavy guitars, tight, plucky, punchy', bass: 'distorted bass, tight', lead: 'clean guitar lead, spacey', drums: 'live drums, dry, punchy' } },
  { id: 'metalcore', name: 'Metalcore', genre: 'metal', aliases: /\bmetal ?core\b|\bpost ?hardcore\b|\bscreamo\b/, bpm: 160, scale: 'minor', root: 2, sounds: { chords: 'heavy distorted guitars, tight', bass: 'distorted bass', lead: 'supersaw lead, wide', drums: 'live drums, punchy' } },
  { id: 'nu-metal', name: 'Nu metal', genre: 'metal', aliases: /\bnu[ -]?metal\b|\bkorn\b|\bdeftones\b/, bpm: 100, scale: 'phrygian', root: 1, swing: 0.15, sounds: { chords: 'heavy guitars, low, dark', bass: 'distorted bass, low, punchy', lead: 'echoey clean guitar lead, spacey', drums: 'live drums, punchy, dry' } },
  { id: 'thrash', name: 'Thrash metal', genre: 'metal', aliases: /\bthrash\b|\bspeed metal\b|\bmetallica\b|\bslayer\b/, bpm: 200, scale: 'phrygian', feel: 'double', sounds: { chords: 'crunchy guitars, tight, bright', bass: 'bass guitar, gritty', lead: 'guitar solo, shredding', drums: 'live drums, punchy' } },

  // Punk family.
  { id: 'pop-punk', name: 'Pop punk', genre: 'punk', aliases: /\bpop[ -]?punk\b|\bblink\b|\beasycore\b/, bpm: 175, scale: 'major', sounds: { chords: 'distorted guitars, bright, wide', bass: 'bass guitar, punchy', lead: 'square lead, bright', drums: 'live drums, punchy, snappy' } },
  { id: 'hardcore', name: 'Hardcore punk', genre: 'punk', aliases: /\bhardcore( punk)?\b|\bpowerviolence\b|\bcrust\b|\bd-?beat\b/, bpm: 205, scale: 'minor', feel: 'double', sounds: { chords: 'raw distorted guitars, thin', bass: 'fuzz bass', lead: 'distorted guitar solo', drums: 'live drums, trashy, roomy' } },
  { id: 'ska-punk', name: 'Ska punk', genre: 'punk', aliases: /\bska\b|\bska[ -]?punk\b/, bpm: 165, scale: 'major', sounds: { chords: 'clean guitars, plucky, bright', bass: 'bass guitar, bouncy', lead: 'brass, punchy', drums: 'live drums, snappy' } },
  { id: 'riot-grrrl', name: 'Riot grrrl / garage punk', genre: 'punk', aliases: /\briot ?gr+l\b|\bgarage punk\b|\bproto ?punk\b/, bpm: 168, scale: 'mixolydian', sounds: { chords: 'fuzzy guitars, thin, raw', bass: 'fuzz bass', lead: 'raw guitar solo', drums: 'live drums, trashy, roomy' } },

  // Drum and bass family.
  { id: 'liquid-dnb', name: 'Liquid drum & bass', genre: 'drum-and-bass', aliases: /\bliquid( dnb| drum (and|&) bass| funk)?\b/, bpm: 174, scale: 'dorian', sounds: { chords: 'electric piano, warm, wide', bass: 'sub bass, warm', lead: 'pluck, echoey, spacey', drums: 'breakbeat drums, crisp' } },
  { id: 'neurofunk', name: 'Neurofunk', genre: 'drum-and-bass', aliases: /\bneuro(funk)?\b|\btechstep\b/, bpm: 174, scale: 'phrygian', sounds: { bass: 'reese bass, distorted, resonant', chords: 'dark synth stabs, metallic', lead: 'resonant saw lead, distorted', drums: 'drum machine, tight, punchy, crisp' } },
  { id: 'jungle', name: 'Jungle', genre: 'drum-and-bass', aliases: /\bjungle\b|\bragga ?jungle\b|\bamen\b/, bpm: 165, scale: 'minor', sounds: { bass: 'sub bass, deep, round', chords: 'pad, dark, spacey', lead: 'stabs, echoey', drums: 'breakbeat drums, dusty, crisp' } },
  { id: 'jump-up', name: 'Jump up', genre: 'drum-and-bass', aliases: /\bjump ?up\b/, bpm: 175, scale: 'minor', sounds: { bass: 'wobble bass, resonant, bouncy', chords: 'synth stabs, punchy', lead: 'square lead, resonant', drums: 'drum machine, punchy, crisp' } },
  { id: 'breakcore', name: 'Breakcore', genre: 'drum-and-bass', aliases: /\bbreakcore\b|\bdigital hardcore\b|\bspeedcore\b/, bpm: 190, scale: 'harmonicMinor', sounds: { bass: 'distorted reese bass', chords: 'pad, spacey, wide', lead: 'chiptune lead, bright', drums: 'breakbeat drums, distorted, crisp' } },
  { id: 'dubstep', name: 'Dubstep', genre: 'drum-and-bass', aliases: /\bdub ?step\b|\bbrostep\b|\briddim\b/, bpm: 140, scale: 'phrygian', feel: 'half', sounds: { bass: 'wobble bass, distorted, fat', chords: 'dark pad', lead: 'resonant saw lead, distorted', drums: 'drum machine, punchy, roomy' } },
  { id: 'garage', name: 'UK garage', genre: 'drum-and-bass', aliases: /\buk ?garage\b|\b2 ?step\b|\bspeed garage\b/, bpm: 134, scale: 'dorian', swing: 0.25, feel: 'half', sounds: { bass: 'sub bass, bouncy', chords: 'organ, plucky', lead: 'pluck, echoey', drums: 'drum machine, crisp, dry' } },

  // Reggaeton family.
  { id: 'dembow', name: 'Dembow', genre: 'reggaeton', aliases: /\bdembow\b|\bdominican\b/, bpm: 120, scale: 'minor', sounds: { bass: '808, punchy', chords: 'synth stabs, bright', lead: 'square lead, bright', drums: '808 drums, punchy, dry' } },
  { id: 'perreo', name: 'Perreo', genre: 'reggaeton', aliases: /\bperreo\b|\bold school reggaeton\b|\bclassic reggaeton\b/, bpm: 96, scale: 'minor', sounds: { bass: '808, deep', chords: 'synth stabs, dark', lead: 'saw lead, echoey', drums: '808 drums, punchy' } },
  { id: 'latin-trap', name: 'Latin trap', genre: 'reggaeton', aliases: /\blatin trap\b|\btrap latino\b/, bpm: 140, scale: 'harmonicMinor', feel: 'half', sounds: { bass: '808, long, gliding, distorted', chords: 'dark pad, spacey', lead: 'bells, dark, echoey', drums: '808 drums, crisp' } },
  { id: 'dancehall', name: 'Dancehall', genre: 'reggaeton', aliases: /\bdancehall\b|\breggae\b|\bmoombahton\b/, bpm: 100, scale: 'minor', sounds: { bass: 'synth bass, round, bouncy', chords: 'organ, plucky, echoey', lead: 'flute, echoey', drums: 'drum machine, dry, snappy' } },
  { id: 'afrobeats', name: 'Afrobeats / amapiano', genre: 'reggaeton', aliases: /\bafro ?beats?\b|\bafro ?pop\b|\bamapiano\b/, bpm: 108, scale: 'dorian', swing: 0.15, sounds: { bass: 'sub bass, plucky, punchy', chords: 'electric piano, warm, wide', lead: 'marimba pluck, bright', drums: 'drum machine, crisp, dry' } },
  { id: 'cumbia', name: 'Cumbia', genre: 'reggaeton', aliases: /\bcumbia\b|\bsalsa\b|\bbachata\b|\bmerengue\b/, bpm: 98, scale: 'minor', swing: 0.1, sounds: { bass: 'bass guitar, round, bouncy', chords: 'accordion organ, bright, plucky', lead: 'flute, bright', drums: 'live drums, crisp' } },

  // Hip hop family (boom bap engine).
  { id: 'trap', name: 'Trap', genre: 'boom-bap', aliases: /\btrap\b|\bdrill\b|\brage\b|\bplugg\b/, bpm: 140, scale: 'harmonicMinor', feel: 'half', swing: 0, sounds: { bass: '808, long, gliding, distorted', chords: 'dark pad, spacey', lead: 'bells, dark, echoey', drums: '808 drums, crisp' } },
  { id: 'phonk', name: 'Phonk', genre: 'boom-bap', aliases: /\bphonk\b|\bmemphis\b|\bcowbell\b/, bpm: 130, scale: 'phrygian', feel: 'half', sounds: { bass: '808, distorted, punchy', chords: 'dark pad, lo-fi', lead: 'bells, lo-fi, resonant', drums: '808 drums, distorted, punchy' } },
  { id: 'lofi', name: 'Lo-fi hip hop', genre: 'boom-bap', aliases: /\blo-?fi( hip ?hop| beats?)?\b|\bchill ?hop\b|\bstudy beats?\b/, bpm: 82, scale: 'dorian', swing: 0.35, sounds: { chords: 'electric piano, lo-fi, warm, wobbly', bass: 'upright bass, warm', lead: 'soft flute, lo-fi', drums: 'dusty drums, soft, lo-fi' } },
  { id: 'rnb', name: 'R&B', genre: 'boom-bap', aliases: /\br ?(&|n|and) ?b\b|\bneo[ -]?soul\b|\bsoul\b|\bslow jam\b/, bpm: 76, scale: 'dorian', swing: 0.2, sounds: { chords: 'electric piano, warm, lush', bass: 'sub bass, round', lead: 'soft pluck, spacey', drums: 'drum machine, soft, crisp' } },
  { id: 'funk', name: 'Funk', genre: 'boom-bap', aliases: /\bfunk(y)?\b|\bg-?funk\b|\bdisco funk\b/, bpm: 105, scale: 'mixolydian', swing: 0.2, sounds: { chords: 'funky clean guitars, plucky', bass: 'slap bass, punchy', lead: 'synth lead, gliding, resonant', drums: 'live drums, dry, snappy' } },

  // Dance family (house engine).
  { id: 'techno', name: 'Techno', genre: 'house', aliases: /\btechno\b|\bwarehouse\b|\brave\b/, bpm: 132, scale: 'phrygian', sounds: { bass: 'acid bass, resonant', chords: 'dark synth stabs, echoey', lead: 'resonant saw lead, dark', drums: 'drum machine, roomy, distorted, punchy' } },
  { id: 'trance', name: 'Trance', genre: 'house', aliases: /\btrance\b|\bpsy ?trance\b|\buplifting\b/, bpm: 138, scale: 'minor', sounds: { bass: 'synth bass, plucky', chords: 'supersaw stabs, wide, huge', lead: 'supersaw lead, wide, echoey', drums: 'drum machine, punchy' } },
  { id: 'disco', name: 'Disco / nu disco', genre: 'house', aliases: /\bdisco\b|\bnu[ -]?disco\b|\bfrench house\b|\bfunky house\b/, bpm: 118, scale: 'dorian', swing: 0.1, sounds: { bass: 'synth bass, bouncy, plucky', chords: 'strings, lush, bright', lead: 'clean guitar lead, plucky', drums: 'drum machine, roomy, crisp' } },
  { id: 'hyperpop', name: 'Hyperpop', genre: 'house', aliases: /\bhyper ?pop\b|\bpc music\b|\bdigicore\b|\bnightcore\b/, bpm: 160, scale: 'major', sounds: { bass: '808, distorted, punchy', chords: 'supersaw stabs, bright, wide', lead: 'chiptune lead, high, bright', drums: '808 drums, distorted, crisp' } },
  { id: 'synth-pop', name: 'Synth pop', genre: 'house', aliases: /\bsynth ?pop\b|\belectro ?pop\b|\bpop\b/, bpm: 118, scale: 'major', sounds: { bass: 'synth bass, punchy', chords: 'pad, bright, wide', lead: 'pluck, bright, echoey', drums: 'drum machine, punchy, crisp' } },
  { id: 'ambient', name: 'Ambient', genre: 'house', aliases: /\bambient\b|\bdrone\b|\bsoundscape\b|\bcinematic\b|\bfilm score\b/, bpm: 80, scale: 'major', sounds: { bass: 'sub bass, soft', chords: 'pad, long, spacey, wide', lead: 'bells, spacey, soft', drums: 'drum machine, soft, spacey' } },
]

function squash(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Finds a style in free text ("a dreamy shoegaze song" → Shoegaze). */
export function findStyle(text: string): Style | undefined {
  const lower = text.toLowerCase()
  return STYLES.find((style) => style.aliases.test(lower))
}

/** Looks a style up by id or name, as the live AI or a saved song gives it. */
export function getStyle(name: string | undefined): Style | undefined {
  if (!name) return undefined
  const wanted = squash(name)
  return STYLES.find((style) => squash(style.id) === wanted || squash(style.name) === wanted) ?? findStyle(name)
}
