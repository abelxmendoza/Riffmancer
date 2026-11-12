import type { VocalChain } from '../studio/presets'
import type { KeyboardMode } from '../beatmaker/input/keymap'
import type { ScaleName } from '../beatmaker/theory'
import type { SynthTweak } from '../beatmaker/tweak'

export type { SynthTweak }

/** Things the assistant can do to the Beat Maker. */
export type BeatAction =
  | { type: 'genre'; id: string }
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'tempo'; bpm?: number; delta?: number }
  | { type: 'fill' }
  | { type: 'variation'; which: 'main' | 'alt' | 'toggle' }
  | { type: 'mutate' }
  | { type: 'reset' }
  | { type: 'key'; root?: number; scale?: ScaleName }
  | { type: 'part'; part: 'drums' | 'bass' | 'chords'; on: boolean }
  | { type: 'keyboardMode'; mode: KeyboardMode }
  | { type: 'synth'; tweak: SynthTweak }
  | { type: 'record'; on: boolean }


export interface BeatStatus {
  ready: boolean
  playing: boolean
  genreId: string
  bpm: number
  root: number
  scale: ScaleName
}

type Handler = (action: BeatAction) => void

let handler: Handler | undefined
const queue: BeatAction[] = []

/** Sends an action to the Beat Maker, or holds it until the Beat Maker is on screen. */
export function dispatchBeat(action: BeatAction) {
  if (handler) handler(action)
  else queue.push(action)
}

export function registerBeatHandler(next: Handler): () => void {
  handler = next
  for (const action of queue.splice(0)) next(action)
  return () => { if (handler === next) handler = undefined }
}

let status: BeatStatus = { ready: false, playing: false, genreId: 'post-punk', bpm: 142, root: 4, scale: 'minor' }
const listeners = new Set<(status: BeatStatus) => void>()

export function publishBeatStatus(next: BeatStatus) {
  status = next
  listeners.forEach((listener) => listener(next))
}

export function getBeatStatus(): BeatStatus {
  return status
}

export function subscribeBeatStatus(listener: (status: BeatStatus) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Opens Fret's chat from anywhere (the nav bar, the landing page). */
export const OPEN_ASSISTANT_EVENT = 'riffmancer:open-assistant'

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))
}

/** Things the assistant can do in the Studio (vocal recording workspace). */
export type StudioAction =
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'record'; on: boolean }
  | { type: 'genre'; id: string }
  | { type: 'preset'; id: string }
  | { type: 'addTrack'; role: 'lead' | 'double' | 'ad-lib' | 'scream' | 'gang' | 'harmony' | 'fx' }
  | { type: 'export'; what: 'mix' | 'stems' }
  | { type: 'metronome'; on: boolean }
  | { type: 'countIn'; bars: number }
  | { type: 'loop'; on: boolean }
  | { type: 'tempo'; bpm?: number; delta?: number }
  | { type: 'import' }
  /** Saves a described or copied vocal sound as one of the person's presets and puts it on the selected track. */
  | { type: 'customPreset'; name: string; chain: VocalChain; description?: string }
  /** Opens "copy a song's vocal sound" on the selected vocal track. */
  | { type: 'matchReference' }
  /** Saves the selected track's current effects as a preset. */
  | { type: 'savePreset'; name: string }

export interface StudioStatus {
  ready: boolean
  playing: boolean
  recording: boolean
  genre: string
  bpm: number
  tracks: number
  armedTrack?: string
}

type StudioHandler = (action: StudioAction) => void

let studioHandler: StudioHandler | undefined
const studioQueue: StudioAction[] = []

/** Sends an action to the Studio, or holds it until the Studio is on screen. */
export function dispatchStudio(action: StudioAction) {
  if (studioHandler) studioHandler(action)
  else studioQueue.push(action)
}

export function registerStudioHandler(next: StudioHandler): () => void {
  studioHandler = next
  for (const action of studioQueue.splice(0)) next(action)
  return () => { if (studioHandler === next) studioHandler = undefined }
}

let studioStatus: StudioStatus = { ready: false, playing: false, recording: false, genre: 'post-punk', bpm: 142, tracks: 1 }
const studioListeners = new Set<(status: StudioStatus) => void>()

export function publishStudioStatus(next: StudioStatus) {
  studioStatus = next
  studioListeners.forEach((listener) => listener(next))
}

export function getStudioStatus(): StudioStatus {
  return studioStatus
}

export function subscribeStudioStatus(listener: (status: StudioStatus) => void): () => void {
  studioListeners.add(listener)
  return () => { studioListeners.delete(listener) }
}

type PromptHandler = (text: string) => void
let promptHandler: PromptHandler | undefined
let pendingPrompt: string | undefined

/** Sends a request to Fret on the Create screen, or holds it until that screen opens. */
export function dispatchSongPrompt(text: string) {
  if (promptHandler) promptHandler(text)
  else pendingPrompt = text
}

export function registerSongPromptHandler(next: PromptHandler): () => void {
  promptHandler = next
  if (pendingPrompt) {
    const text = pendingPrompt
    pendingPrompt = undefined
    next(text)
  }
  return () => { if (promptHandler === next) promptHandler = undefined }
}
