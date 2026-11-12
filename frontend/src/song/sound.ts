import type { SynthPart } from '../beatmaker/engine/types'
import { DEFAULT_KIT, DEFAULT_PATCH, type KitPatch, type SynthPatch } from '../beatmaker/genres'
import { getInstrument, isDrumSet, namedInstrument, type RealInstrument } from './instruments'

/**
 * Turns plain words about a sound ("fuzzy wide guitars", "a deep 808", "glassy bells", "roomy
 * punchy drums") into synth and drum-kit settings. Pure data in, data out, so it can be tested
 * and shared by the offline brain, the live AI and the style catalogue.
 */

export type SoundPart = SynthPart | 'drums'

export const SOUND_PARTS: SoundPart[] = ['bass', 'chords', 'lead', 'drums']

interface Instrument {
  name: string
  /** A current sound whose name matches is the same instrument, so describing words tweak it instead of starting over. */
  family?: RegExp
  part: SoundPart
  pattern: RegExp
  patch?: Partial<SynthPatch>
  kit?: Partial<KitPatch>
}

/**
 * Instruments, most specific first ("fuzz bass" before "bass guitar" before "guitar").
 * Each one is a full starting sound; describing words then nudge it.
 */
const INSTRUMENTS: Instrument[] = [
  // Bass.
  { name: '808 bass', family: /808/i, part: 'bass', pattern: /\b808s?\b(?! (drums?|kit|kick|snare))/, patch: { wave: 'sine', octave: -1, attack: 0.002, decay: 1.2, sustain: 0.7, release: 0.5, cutoff: 900, filterEnv: 0, drive: 0.2, glide: 0.06, reverb: 0, volume: -5 } },
  { name: 'sub bass', family: /\bsub\b|808/i, part: 'bass', pattern: /\bsub(\s|-)?bass\b|\bsubs\b/, patch: { wave: 'sine', octave: -1, sustain: 0.95, release: 0.2, cutoff: 700, filterEnv: 0, reverb: 0, volume: -5 } },
  { name: 'reese bass', family: /reese/i, part: 'bass', pattern: /\breese\b|\bgrowl(y|ing)? bass\b|\bneuro bass\b/, patch: { wave: 'fatsawtooth', spread: 35, octave: -1, cutoff: 700, resonance: 3, filterEnv: 0.8, sustain: 0.9, drive: 0.45, chorus: 0.3, reverb: 0.05, volume: -9 } },
  { name: 'wobble bass', part: 'bass', pattern: /\bwobbl(e|y) bass\b|\bdubstep bass\b/, patch: { wave: 'sawtooth', octave: -1, cutoff: 500, resonance: 9, filterEnv: 3, filterDecay: 0.3, drive: 0.5, sustain: 0.8, volume: -9 } },
  { name: 'acid bass', part: 'bass', pattern: /\bacid\b|\b303\b|\bsquelch(y)?\b/, patch: { wave: 'sawtooth', cutoff: 380, resonance: 13, filterEnv: 4, filterDecay: 0.15, decay: 0.15, sustain: 0.35, drive: 0.35, glide: 0.06, volume: -11 } },
  { name: 'fuzz bass', family: /fuzz|distorted/i, part: 'bass', pattern: /\b(fuzz|fuzzy|distorted|overdriven|dirty|gritty) bass\b/, patch: { wave: 'square', octave: -1, cutoff: 1500, filterEnv: 0.8, sustain: 0.8, drive: 0.7, reverb: 0.05, volume: -10 } },
  { name: 'slap bass', family: /bass guitar|slap/i, part: 'bass', pattern: /\bslap(ped|py)? bass\b|\bfunk(y)? bass\b/, patch: { sample: 'slap_bass_1', wave: 'triangle', octave: -1, attack: 0.003, decay: 0.3, sustain: 0.4, release: 0.12, cutoff: 2200, filterEnv: 2, filterDecay: 0.1, drive: 0.1, reverb: 0.04, volume: -7 } },
  { name: 'picked bass', family: /bass guitar|pick/i, part: 'bass', pattern: /\bpick(ed)? bass\b|\bpunk bass\b/, patch: { sample: 'electric_bass_pick', wave: 'triangle', octave: -1, attack: 0.003, decay: 0.3, sustain: 0.5, release: 0.12, cutoff: 2000, filterEnv: 1.8, filterDecay: 0.1, drive: 0.3, reverb: 0.04, volume: -7 } },
  { name: 'fretless bass', family: /bass guitar|fretless/i, part: 'bass', pattern: /\bfretless\b/, patch: { sample: 'fretless_bass', wave: 'sine', octave: -1, attack: 0.01, decay: 0.5, sustain: 0.6, release: 0.2, cutoff: 1400, filterEnv: 0.6, glide: 0.04, reverb: 0.1, volume: -7 } },
  { name: 'bass guitar', family: /bass guitar|pick bass/i, part: 'bass', pattern: /\bbass guitar\b|\belectric bass\b|\bfinger(ed|style)? bass\b|\breal bass\b|\blive bass\b/, patch: { sample: 'electric_bass_finger', wave: 'triangle', octave: -1, attack: 0.003, decay: 0.35, sustain: 0.5, release: 0.15, cutoff: 1800, filterEnv: 1.6, filterDecay: 0.12, drive: 0.25, reverb: 0.05, volume: -7 } },
  { name: 'synth bass', part: 'bass', pattern: /\bsynth ?bass\b|\bmoog bass\b|\banalog bass\b/, patch: { wave: 'sawtooth', octave: -1, cutoff: 900, resonance: 4, filterEnv: 2, filterDecay: 0.2, sustain: 0.6, glide: 0.03, reverb: 0.05, volume: -8 } },
  { name: 'upright bass', part: 'bass', pattern: /\b(upright|double|acoustic|jazz) bass\b/, patch: { sample: 'acoustic_bass', wave: 'triangle', octave: -1, attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.3, cutoff: 1100, filterEnv: 1, filterDecay: 0.1, reverb: 0.15, volume: -6 } },

  // Chords.
  { name: 'palm-muted guitar', family: /guitar/i, part: 'chords', pattern: /\bpalm[ -]?mut(ed|ing|e)\b|\bmuted guitars?\b/, patch: { sample: 'electric_guitar_muted', wave: 'square', attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.08, cutoff: 2600, filterEnv: 1.5, filterDecay: 0.08, drive: 0.6, reverb: 0.1, volume: -11 } },
  { name: 'acoustic guitar', family: /guitar/i, part: 'chords', pattern: /\b(acoustic|strummed|folk|campfire|steel[ -]string) guitars?\b/, patch: { sample: 'acoustic_guitar_steel', wave: 'triangle', attack: 0.003, decay: 0.6, sustain: 0.2, release: 0.5, cutoff: 4000, filterEnv: 1.2, filterDecay: 0.15, reverb: 0.25, volume: -10 } },
  { name: 'nylon guitar', family: /guitar/i, part: 'chords', pattern: /\b(nylon|classical|spanish|flamenco) guitars?\b/, patch: { sample: 'acoustic_guitar_nylon', wave: 'triangle', attack: 0.003, decay: 0.6, sustain: 0.2, release: 0.5, cutoff: 3500, filterEnv: 1, filterDecay: 0.15, reverb: 0.25, volume: -10 } },
  { name: 'distorted guitar', family: /guitar/i, part: 'chords', pattern: /\b(fuzz|fuzzy|distorted|overdriven|heavy|crunchy|chuggy|metal|dirty|gritty|loud|shoegaze) guitars?\b|\bpower chords?\b|\bwall of (fuzz|guitars?|noise)\b/, patch: { sample: 'distortion_guitar', wave: 'fatsawtooth', spread: 24, attack: 0.004, decay: 0.3, sustain: 0.75, release: 0.2, cutoff: 3200, resonance: 1.5, filterEnv: 0.6, drive: 0.75, chorus: 0.1, reverb: 0.2, volume: -12 } },
  { name: 'clean guitar', family: /guitar/i, part: 'chords', pattern: /\b(clean|jangly|janglier|chorus(ed)?|shimmer(y|ing)?|twangy|surf|funk(y)?|electric) guitars?\b/, patch: { sample: 'electric_guitar_clean', wave: 'triangle', attack: 0.003, decay: 0.5, sustain: 0.25, release: 0.4, cutoff: 4200, filterEnv: 1.2, filterDecay: 0.15, chorus: 0.55, delay: 0.15, reverb: 0.3, volume: -11 } },
  { name: 'electric piano', family: /piano|keys/i, part: 'chords', pattern: /\b(electric piano|e-?piano|rhodes|wurli(tzer)?|keys)\b/, patch: { sample: 'electric_piano_1', wave: 'sine', attack: 0.004, decay: 0.9, sustain: 0.3, release: 0.7, cutoff: 3000, filterEnv: 0.6, chorus: 0.4, reverb: 0.3, volume: -9 } },
  { name: 'piano', family: /piano/i, part: 'chords', pattern: /\bpianos?\b/, patch: { sample: 'acoustic_grand_piano', wave: 'triangle', attack: 0.002, decay: 1.1, sustain: 0.15, release: 0.9, cutoff: 5000, filterEnv: 1, filterDecay: 0.2, reverb: 0.3, volume: -9 } },
  { name: 'organ', part: 'chords', pattern: /\borgans?\b|\bhammond\b/, patch: { sample: 'rock_organ', wave: 'square', attack: 0.01, decay: 0.1, sustain: 1, release: 0.15, cutoff: 2400, filterEnv: 0, chorus: 0.5, reverb: 0.2, volume: -15 } },
  { name: 'synth strings', part: 'chords', pattern: /\bsynth strings?\b|\bstring machine\b|\bsolina\b/, patch: { sample: 'synth_strings_1', wave: 'fatsawtooth', spread: 18, attack: 0.4, decay: 0.4, sustain: 0.85, release: 1.2, cutoff: 2400, filterEnv: 0.2, chorus: 0.5, reverb: 0.5, volume: -14 } },
  { name: 'strings', part: 'chords', pattern: /\bstrings?\b|\borchestra(l)?\b|\bviolins\b|\bcellos\b/, patch: { sample: 'string_ensemble_1', wave: 'fatsawtooth', spread: 18, attack: 0.5, decay: 0.4, sustain: 0.85, release: 1.2, cutoff: 2600, filterEnv: 0.2, chorus: 0.4, reverb: 0.55, volume: -15 } },
  { name: 'pad', family: /\bpad\b/i, part: 'chords', pattern: /\b(synth )?pads?\b|\bwash(ed)? out\b|\bdrone\b/, patch: { wave: 'fatsawtooth', spread: 30, attack: 0.7, decay: 0.5, sustain: 0.8, release: 1.8, cutoff: 1500, filterEnv: 0.4, chorus: 0.5, reverb: 0.65, volume: -16 } },
  { name: 'brass', part: 'chords', pattern: /\bbrass\b|\bhorns?\b|\btrumpets\b/, patch: { sample: 'brass_section', wave: 'sawtooth', attack: 0.04, decay: 0.3, sustain: 0.7, release: 0.25, cutoff: 1400, filterEnv: 2, filterDecay: 0.18, reverb: 0.25, volume: -12 } },
  { name: 'choir', part: 'chords', pattern: /\bchoirs?\b|\bvoices\b|\baahs?\b/, patch: { sample: 'choir_aahs', wave: 'fattriangle', spread: 20, attack: 0.35, decay: 0.4, sustain: 0.85, release: 1.2, cutoff: 2000, filterEnv: 0, chorus: 0.6, reverb: 0.6, volume: -13 } },
  { name: 'synth stabs', part: 'chords', pattern: /\bstabs?\b|\brave (chords?|stabs?)\b/, patch: { wave: 'fatsawtooth', spread: 22, attack: 0.002, decay: 0.2, sustain: 0.1, release: 0.15, cutoff: 2600, filterEnv: 2, filterDecay: 0.12, reverb: 0.3, volume: -13 } },
  { name: 'guitar', family: /guitar/i, part: 'chords', pattern: /\bguitars?\b/, patch: { sample: 'overdriven_guitar', wave: 'fatsawtooth', spread: 15, attack: 0.004, decay: 0.35, sustain: 0.6, release: 0.25, cutoff: 3000, filterEnv: 0.8, drive: 0.35, chorus: 0.2, reverb: 0.25, volume: -12 } },

  // Lead.
  { name: 'music box', part: 'lead', pattern: /\bmusic ?box\b/, patch: { sample: 'music_box', wave: 'sine', attack: 0.001, decay: 0.9, sustain: 0, release: 1.2, cutoff: 6000, filterEnv: 0, delay: 0.2, reverb: 0.4, volume: -10 } },
  { name: 'bells', family: /bell/i, part: 'lead', pattern: /\bbells?\b|\bchimes?\b/, patch: { wave: 'sine', attack: 0.001, decay: 0.9, sustain: 0, release: 1.2, cutoff: 8000, filterEnv: 0, delay: 0.25, reverb: 0.45, octave: 1, volume: -10 } },
  { name: 'flute', part: 'lead', pattern: /(?<!pan ?)\bflutes?\b/, patch: { sample: 'flute', wave: 'sine', attack: 0.06, decay: 0.2, sustain: 0.8, release: 0.3, cutoff: 3000, filterEnv: 0, chorus: 0.2, reverb: 0.35, glide: 0.03, octave: 1, volume: -11 } },
  { name: 'chiptune lead', part: 'lead', pattern: /\bchip ?tune\b|\b8[ -]?bit\b|\bnintendo\b|\bgame ?boy\b|\bsquare (lead|wave)\b/, patch: { wave: 'square', attack: 0.001, decay: 0.1, sustain: 0.6, release: 0.05, cutoff: 9000, filterEnv: 0, reverb: 0.05, volume: -16 } },
  { name: 'guitar solo', family: /guitar|shred/i, part: 'lead', pattern: /\b(guitar (solo|lead|riff)|lead guitar|shred(ding)?)\b/, patch: { sample: 'distortion_guitar', wave: 'sawtooth', attack: 0.003, decay: 0.3, sustain: 0.8, release: 0.3, cutoff: 3500, resonance: 2, filterEnv: 0.5, drive: 0.8, delay: 0.25, reverb: 0.3, glide: 0.04, volume: -13 } },
  { name: 'violin', part: 'lead', pattern: /\bviolins?\b(?! section)|\bfiddle\b/, patch: { sample: 'violin', wave: 'sawtooth', attack: 0.12, decay: 0.3, sustain: 0.85, release: 0.4, cutoff: 3200, filterEnv: 0.2, chorus: 0.2, reverb: 0.45, glide: 0.05, volume: -13 } },
  { name: 'trumpet', part: 'lead', pattern: /\btrumpet\b/, patch: { sample: 'trumpet', wave: 'sawtooth', attack: 0.03, decay: 0.3, sustain: 0.75, release: 0.25, cutoff: 1800, filterEnv: 1.5, filterDecay: 0.15, reverb: 0.25, volume: -11 } },
  { name: 'saxophone', part: 'lead', pattern: /\bsax(ophone)?s?\b/, patch: { sample: 'alto_sax', wave: 'sawtooth', attack: 0.03, decay: 0.3, sustain: 0.8, release: 0.25, cutoff: 1600, filterEnv: 1, filterDecay: 0.2, glide: 0.03, reverb: 0.3, volume: -11 } },
  { name: 'marimba', part: 'lead', pattern: /\bmarimbas?\b/, patch: { sample: 'marimba', wave: 'sine', attack: 0.001, decay: 0.4, sustain: 0, release: 0.4, cutoff: 4000, filterEnv: 1, filterDecay: 0.06, reverb: 0.25, volume: -9 } },
  { name: 'pizzicato', part: 'lead', pattern: /\bpizzicato\b/, patch: { sample: 'pizzicato_strings', wave: 'triangle', attack: 0.001, decay: 0.25, sustain: 0, release: 0.3, cutoff: 4000, filterEnv: 2, filterDecay: 0.08, reverb: 0.35, volume: -9 } },
  { name: 'pluck', part: 'lead', pattern: /\bplucks?\b/, patch: { wave: 'triangle', attack: 0.001, decay: 0.25, sustain: 0, release: 0.3, cutoff: 5000, filterEnv: 2.5, filterDecay: 0.08, delay: 0.3, reverb: 0.3, volume: -9 } },
  { name: 'saw lead', part: 'lead', pattern: /\b(synth|saw|supersaw|trance|screaming|lead) (lead|synth)\b|\bsupersaw\b/, patch: { wave: 'fatsawtooth', spread: 28, attack: 0.005, sustain: 0.8, release: 0.3, cutoff: 4500, filterEnv: 0.8, chorus: 0.2, delay: 0.25, reverb: 0.3, glide: 0.02, volume: -14 } },

  // Drums.
  { name: '808 drums', part: 'drums', pattern: /\b(808|trap) (drums?|kit|kick)\b|\btr-?808\b/, kit: { set: 'tr808', kickPitch: 27, kickDecay: 1.1, kickPunch: 0.35, snareTone: 0.2, snareDecay: 0.14, snareBrightness: 5500, hatDecay: 0.03, drive: 0.1, room: 0.08 } },
  { name: 'live drums', part: 'drums', pattern: /\b(live|real|acoustic|rock|recorded|human|jazz|band) (drums?|kit|drummer)\b|\breal drummer\b/, kit: { set: 'acoustic', kickPitch: 38, kickDecay: 0.35, kickPunch: 0.6, snareTone: 0.55, snareDecay: 0.22, snareBrightness: 3500, hatDecay: 0.06, room: 0.35 } },
  { name: 'drum machine', part: 'drums', pattern: /\bdrum machine\b|\b909\b|\blinn ?drum\b|\b(electronic|machine) drums?\b/, kit: { kickPitch: 34, kickDecay: 0.5, kickPunch: 0.55, snareTone: 0.35, snareDecay: 0.16, snareBrightness: 4500, hatDecay: 0.04, room: 0.1 } },
  { name: 'breakbeat drums', part: 'drums', pattern: /\bbreaks? ?beat\b|\bamen\b|\bdusty drums?\b|\bvinyl drums?\b/, kit: { kickPitch: 40, kickDecay: 0.3, kickPunch: 0.5, snareTone: 0.5, snareDecay: 0.2, snareBrightness: 3200, hatDecay: 0.05, drive: 0.2, room: 0.2 } },
]

interface Describer {
  word: string
  pattern: RegExp
  patch?: (patch: SynthPatch) => Partial<SynthPatch>
  kit?: (kit: KitPatch) => Partial<KitPatch>
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))

/** Describing words. Each nudges the sound in an audible direction. */
const DESCRIBERS: Describer[] = [
  { word: 'dark', pattern: /\b(dark(er)?|murk(y|ier)|muffled|warm(er)?|mellow(er)?|round(er)?|deep(er)?|smooth(er)?)\b/, patch: (p) => ({ cutoff: Math.max(200, p.cutoff * 0.55) }), kit: (k) => ({ snareBrightness: Math.max(1500, k.snareBrightness * 0.65), kickPitch: Math.max(24, k.kickPitch - 4) }) },
  { word: 'bright', pattern: /\b(bright(er)?|crisp(y|er|ier)?|sparkl(y|ier|ing)|air(y|ier)|shin(y|ier)|glass(y|ier)|cutting|sharp(er)?)\b/, patch: (p) => ({ cutoff: Math.min(14000, p.cutoff * 1.8) }), kit: (k) => ({ snareBrightness: Math.min(9000, k.snareBrightness * 1.4), hatDecay: Math.max(0.02, k.hatDecay * 0.8) }) },
  { word: 'distorted', pattern: /\b(distort(ed|ion)?|fuzz(y|ier|ed)?|gritt?(y|ier)|dirt(y|ier)|crunch(y|ier)?|saturated|overdriven|raw(er)?|nast(y|ier)|filth(y|ier)|blown[ -]?out|growl(y|ier|ing)?)\b/, patch: (p) => ({ drive: clamp(Math.max(p.drive, 0.35) + 0.3) }), kit: (k) => ({ drive: clamp(k.drive + 0.35) }) },
  { word: 'clean', pattern: /\b(clean(er)?|pure|pristine|polished|hi-?fi)\b/, patch: () => ({ drive: 0 }), kit: () => ({ drive: 0 }) },
  { word: 'spacey', pattern: /\b(spac(e|ey|y|ier)|dream(y|ier)?|ethereal|wash(ed|y)?|ambient|cavern(ous)?|reverb(y)?|wet(ter)?|haunting|atmospheric|shoegaz(e|ey))\b/, patch: (p) => ({ reverb: clamp(p.reverb + 0.35), delay: clamp(p.delay + 0.15) }), kit: (k) => ({ room: clamp(k.room + 0.3) }) },
  { word: 'echoey', pattern: /\b(echo(ey|y|es)?|delay(ed)?|dub(by)?|bouncing)\b/, patch: (p) => ({ delay: clamp(p.delay + 0.35) }) },
  { word: 'dry', pattern: /\b(dry|tight(er)?|close|in your face|upfront)\b/, patch: () => ({ reverb: 0.03, delay: 0 }), kit: (k) => ({ room: 0.03, kickDecay: Math.max(0.15, k.kickDecay * 0.75), snareDecay: Math.max(0.08, k.snareDecay * 0.8) }) },
  { word: 'wide', pattern: /\b(wide(r)?|lush(er)?|chorus(ed|y)|detuned|stereo|shimmer(y|ing)?|wobbl(y|ier)|warbl(y|ing)|wonky|seasick)\b/, patch: (p) => ({ chorus: clamp(p.chorus + 0.4), spread: Math.max(p.spread, 30) }) },
  { word: 'fat', pattern: /\b(fat(ter)?|thick(er)?|huge|massive|big(ger)?|full(er)?|beefy|chunky|heavy|heavier|boom(y)?)\b/, patch: (p) => ({ wave: p.wave === 'sawtooth' ? 'fatsawtooth' : p.wave === 'square' ? 'fatsquare' : p.wave === 'triangle' ? 'fattriangle' : p.wave, spread: Math.max(p.spread, 25), volume: Math.min(-4, p.volume + 2) }), kit: (k) => ({ kickDecay: Math.min(1.4, k.kickDecay * 1.4), kickPitch: Math.max(24, k.kickPitch - 3), snareTone: clamp(k.snareTone + 0.2), volume: Math.min(0, k.volume + 1) }) },
  { word: 'thin', pattern: /\b(thin(ner)?|small(er)?|tinny|lo-?fi|lofi|old school|vintage|retro|dusty|telephone|radio)\b/, patch: (p) => ({ cutoff: Math.min(p.cutoff, 2200), spread: 0, wave: p.wave.startsWith('fat') ? (p.wave.slice(3) as SynthPatch['wave']) : p.wave, chorus: clamp(p.chorus + 0.15) }), kit: (k) => ({ snareBrightness: Math.min(k.snareBrightness, 2800), drive: clamp(k.drive + 0.15), room: clamp(k.room * 0.6) }) },
  { word: 'punchy', pattern: /\b(punch(y|ier)?|snappy|snappier|aggressive|hard(er)?|hit(s|ting)? hard|percussive|attack(y)?)\b/, patch: (p) => ({ attack: 0.001, filterEnv: Math.max(p.filterEnv, 1.8), filterDecay: Math.min(p.filterDecay, 0.15) }), kit: (k) => ({ kickPunch: clamp(k.kickPunch + 0.3), snareDecay: Math.max(0.1, k.snareDecay * 0.85), snareTone: clamp(k.snareTone + 0.1) }) },
  { word: 'soft', pattern: /\b(soft(er)?|gentle|gentler|quiet|subtle|delicate|lazy|laid ?back|chill)\b/, patch: (p) => ({ attack: Math.max(p.attack, 0.03), drive: p.drive * 0.4, volume: p.volume - 3 }), kit: (k) => ({ kickPunch: clamp(k.kickPunch - 0.25), volume: k.volume - 3 }) },
  { word: 'plucky', pattern: /\b(pluck(y|ed)?|short|staccato|choppy|stabby|bouncy)\b/, patch: () => ({ attack: 0.001, decay: 0.18, sustain: 0, release: 0.15 }), kit: (k) => ({ kickDecay: Math.max(0.15, k.kickDecay * 0.6), hatDecay: 0.03 }) },
  { word: 'long', pattern: /\b(long(er)?|sustain(ed|ing)?|swell(ing|s)?|slow attack|evolving|droning|legato)\b/, patch: (p) => ({ attack: Math.max(p.attack, 0.25), sustain: Math.max(p.sustain, 0.8), release: Math.max(p.release, 1.2) }), kit: (k) => ({ kickDecay: Math.min(1.4, k.kickDecay * 1.6), snareDecay: Math.min(0.4, k.snareDecay * 1.4), hatDecay: Math.min(0.2, k.hatDecay * 1.5) }) },
  { word: 'gliding', pattern: /\b(glid(e|ing|ey|y)|slid(e|es|ing|ey|y)|portamento|bend(y|ing)?)\b/, patch: () => ({ glide: 0.09 }) },
  { word: 'resonant', pattern: /\b(resonan(t|ce)|squelch(y)?|wah|nasal|metallic|zappy|laser)\b/, patch: (p) => ({ resonance: Math.max(p.resonance, 9), filterEnv: Math.max(p.filterEnv, 2.5) }) },
  { word: 'roomy', pattern: /\b(roomy|room(s)?|live|arena|stadium|garage|hall)\b/, kit: (k) => ({ room: clamp(k.room + 0.3) }), patch: (p) => ({ reverb: clamp(p.reverb + 0.2) }) },
  { word: 'trashy', pattern: /\b(trash(y)?|sizzl(y|ing)|splashy|washy cymbals?)\b/, kit: (k) => ({ hatDecay: Math.min(0.2, k.hatDecay * 2), drive: clamp(k.drive + 0.15) }) },
  { word: 'low', pattern: /\b(low(er)?|sub(by)?|rumbl(e|y|ing)|down an octave)\b/, patch: (p) => ({ octave: Math.max(-2, p.octave - 1) }), kit: (k) => ({ kickPitch: Math.max(24, k.kickPitch - 6) }) },
  { word: 'high', pattern: /\b(high(er)?|up an octave|squeaky|twinkl(y|ing))\b/, patch: (p) => ({ octave: Math.min(2, p.octave + 1) }), kit: (k) => ({ kickPitch: Math.min(60, k.kickPitch + 6) }) },
]

const PART_NOUNS: [RegExp, SoundPart][] = [
  [/\b(drums?|kit|beat|percussion|kicks?|snares?|hi-?hats?|hats|cymbals?)\b/, 'drums'],
  [/\bbass(line|es)?\b|\blow end\b/, 'bass'],
  [/\b(chords?|rhythm|harmony|backing)\b/, 'chords'],
  [/\b(lead|melody|melodies|hook|riff|topline|synth line)\b/, 'lead'],
]

export interface SoundRequest {
  part: SoundPart
  /** The instrument named, if any ("piano", "808 bass"). */
  instrument?: string
  /** Describing words found, in a stable order ("dark", "wide"). */
  words: string[]
  /** The words this request was read from. */
  text: string
}

function findInstrument(text: string, part?: SoundPart): Instrument | undefined {
  return INSTRUMENTS.find((instrument) => (!part || instrument.part === part) && instrument.pattern.test(text))
}

function describersIn(text: string): Describer[] {
  return DESCRIBERS.filter((describer) => describer.pattern.test(text))
}

/** Words that make "make the chorus heavier" an arrangement change, not a sound description. */
const NOT_A_SOUND = /\b(intros?|verses?|chorus(es)?|bridges?|breakdowns?|drops?|outros?|song|track|tempo|key)\b/

/**
 * Finds every instrument description in a request. "fuzzy guitars and a deep 808, bells on top"
 * gives three requests: chords, bass and lead. Words with no instrument stick to the one before
 * ("guitars that are fuzzy and wide").
 */
export function parseSoundRequests(input: string): SoundRequest[] {
  const text = input.toLowerCase().replace(/[^a-z0-9#&'\s,;-]/g, ' ')
  const clauses = text.split(/,|;|\band\b|\bwith\b|\bplus\b|\bover\b|\bon top\b|\bunder\b|\bbut\b/).map((clause) => clause.trim()).filter(Boolean)
  const requests: SoundRequest[] = []
  for (const clause of clauses) {
    const instrument = findInstrument(clause)
    const named = instrument ? undefined : namedInstrument(clause)
    const nouns = PART_NOUNS.filter(([pattern]) => pattern.test(clause)).map(([, part]) => part)
    const part = instrument?.part ?? (nouns.length === 1 ? nouns[0] : named?.parts[0])
    const words = describersIn(clause).map((describer) => describer.word)
    if (part) {
      requests.push({ part, instrument: instrument?.name ?? named?.name.toLowerCase(), words, text: clause })
    } else if (words.length && requests.length) {
      const last = requests[requests.length - 1]
      last.words = [...new Set([...last.words, ...words])]
      last.text = `${last.text} ${clause}`
    }
  }
  // One part, one request: later mentions add to earlier ones.
  const merged = new Map<SoundPart, SoundRequest>()
  for (const request of requests) {
    const before = merged.get(request.part)
    if (!before) merged.set(request.part, request)
    else merged.set(request.part, { part: request.part, instrument: request.instrument ?? before.instrument, words: [...new Set([...before.words, ...request.words])], text: `${before.text} ${request.text}` })
  }
  return [...merged.values()].filter((request) => request.instrument || request.words.length)
}

/** True when the text describes how something sounds, not how the song is arranged. */
export function describesSound(input: string): boolean {
  const text = input.toLowerCase()
  if (INSTRUMENTS.some((instrument) => instrument.pattern.test(text)) || namedInstrument(text)) return true
  return !NOT_A_SOUND.test(text) && parseSoundRequests(text).some((request) => request.words.length > 0)
}

function title(words: string[], instrument: string | undefined, part: SoundPart) {
  const noun = instrument ?? (part === 'drums' ? 'kit' : part)
  const label = [...words.filter((word) => !noun.split(' ').includes(word)), noun].join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Any General MIDI instrument ("banjo", "harpsichord") as a starting sound: the recording plus a plain synth stand-in. */
function fromLibrary(real: RealInstrument | undefined): Instrument | undefined {
  if (!real) return undefined
  const plucked = real.release < 0.6
  return {
    name: real.name.toLowerCase(),
    part: real.parts[0],
    pattern: /$^/,
    patch: { sample: real.id, wave: plucked ? 'triangle' : 'sawtooth', octave: 0, attack: plucked ? 0.002 : 0.04, decay: 0.5, sustain: plucked ? 0.2 : 0.8, release: real.release, cutoff: 2500, filterEnv: plucked ? 1 : 0.3, filterDecay: 0.15, drive: 0, chorus: 0, delay: 0, reverb: 0.25, volume: -10 },
  }
}

/** The starting sound for a recorded instrument by id ("distortion_guitar", "banjo"), or undefined. */
export function instrumentPatch(id: string): SynthPatch | undefined {
  const real = getInstrument(id)
  if (!real) return undefined
  const known = INSTRUMENTS.find((instrument) => instrument.patch?.sample === id)
  const base = known ?? fromLibrary(real)!
  return { ...DEFAULT_PATCH, ...base.patch, sample: id, name: known ? title([], known.name, known.part) : real.name }
}

/** Builds a synth sound from a description, starting from `base` when no instrument is named. */
export function designPatch(description: string, base: SynthPatch, part: SynthPart): { patch: SynthPatch; label: string } | undefined {
  const text = description.toLowerCase()
  const instrument = findInstrument(text, part) ?? findInstrument(text) ?? fromLibrary(namedInstrument(text))
  const describers = describersIn(text)
  if (!instrument?.patch && !describers.some((describer) => describer.patch)) return undefined
  // "fuzzier guitars" on a guitar keeps that guitar and adds fuzz; "piano" on a guitar swaps it.
  const sameInstrument = Boolean(instrument && describers.length && (instrument.family ?? new RegExp(instrument.name, 'i')).test(base.name))
  // A synth stand-in for a real instrument ("Punk guitar") becomes the recording when it's named.
  const upgrade = Boolean(instrument?.patch?.sample && !base.sample)
  const fresh = instrument?.patch && (!sameInstrument || upgrade)
  let patch: SynthPatch = fresh ? { ...DEFAULT_PATCH, ...instrument.patch } : { ...base }
  for (const describer of describers) if (describer.patch) patch = { ...patch, ...describer.patch(patch) }
  const words = describers.filter((describer) => describer.patch).map((describer) => describer.word)
  const label = title(words, instrument?.name, part)
  return { patch: { ...patch, name: label }, label: label.toLowerCase() }
}

/** Builds a drum-kit sound from a description, starting from `base` when no kit is named. */
export function designKit(description: string, base: KitPatch): { kit: KitPatch; label: string } | undefined {
  const text = description.toLowerCase()
  const instrument = INSTRUMENTS.find((candidate) => candidate.part === 'drums' && candidate.pattern.test(text))
  const describers = describersIn(text).filter((describer) => describer.kit)
  if (!instrument && !describers.length) return undefined
  let kit: KitPatch = instrument?.kit ? { ...DEFAULT_KIT, ...instrument.kit } : { ...base }
  for (const describer of describers) if (describer.kit) kit = { ...kit, ...describer.kit(kit) }
  return { kit, label: title(describers.map((describer) => describer.word), instrument?.name, 'drums').toLowerCase() }
}

/** Every instrument Fret knows, for help text and the live AI's instructions. */
export function instrumentNames(part?: SoundPart): string[] {
  return INSTRUMENTS.filter((instrument) => !part || instrument.part === part).map((instrument) => instrument.name)
}

export function soundWords(): string[] {
  return DESCRIBERS.map((describer) => describer.word)
}

/** Numbers the live AI may set directly, with their safe ranges. */
export const PATCH_RANGES: Partial<Record<keyof SynthPatch, [number, number]>> = {
  spread: [0, 60], octave: [-2, 2], attack: [0.001, 2], decay: [0.01, 3], sustain: [0, 1], release: [0.01, 4],
  cutoff: [100, 16000], resonance: [0.1, 20], filterEnv: [0, 6], filterDecay: [0.01, 2],
  drive: [0, 1], chorus: [0, 1], delay: [0, 1], reverb: [0, 1], glide: [0, 0.5], volume: [-30, 0],
}

export const KIT_RANGES: Record<Exclude<keyof KitPatch, 'set'>, [number, number]> = {
  kickPitch: [20, 80], kickDecay: [0.05, 2], kickPunch: [0, 1], snareTone: [0, 1], snareDecay: [0.03, 0.6],
  snareBrightness: [800, 12000], hatDecay: [0.01, 0.4], drive: [0, 1], room: [0, 1], volume: [-24, 0],
}

const WAVES: SynthPatch['wave'][] = ['sine', 'triangle', 'sawtooth', 'square', 'fatsawtooth', 'fatsquare', 'fattriangle']

/** Applies exact numbers (from the live AI), clamped to safe ranges; unknown keys are ignored. */
export function applyPatchSettings(patch: SynthPatch, settings: Record<string, unknown>): SynthPatch {
  const next = { ...patch }
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'wave' && WAVES.includes(value as SynthPatch['wave'])) next.wave = value as SynthPatch['wave']
    // A recorded instrument by id; "synth" or an empty value goes back to the synthesizer.
    if (key === 'sample') {
      if (typeof value === 'string' && getInstrument(value)) next.sample = value
      else if (value === '' || value === null || value === 'synth' || value === false) delete next.sample
    }
    const range = PATCH_RANGES[key as keyof SynthPatch]
    if (range && typeof value === 'number' && Number.isFinite(value)) (next as unknown as Record<string, number>)[key] = clamp(value, range[0], range[1])
  }
  return next
}

export function applyKitSettings(kit: KitPatch, settings: Record<string, unknown>): KitPatch {
  const next = { ...kit }
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'set') {
      if (isDrumSet(value)) next.set = value
      else if (value === '' || value === null || value === 'synth' || value === false) delete next.set
      continue
    }
    const range = KIT_RANGES[key as Exclude<keyof KitPatch, 'set'>]
    if (range && typeof value === 'number' && Number.isFinite(value)) next[key as Exclude<keyof KitPatch, 'set'>] = clamp(value, range[0], range[1])
  }
  return next
}
