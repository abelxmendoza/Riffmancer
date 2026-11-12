/** Pure playlist logic: what plays next, with shuffle and repeat. */

export type RepeatMode = 'off' | 'all' | 'one'

export interface Track {
  id: string
  title: string
  /** Object URL for the audio. */
  url: string
  /** Seconds, once the browser has read it. */
  duration?: number
  /** True for the built-in demo loop. */
  demo?: boolean
}

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|webm|aiff?)$/i

/** True for files the browser can probably play. */
export function isAudioFile(file: { name: string; type: string }) {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name)
}

/** "01 - my_song-final.mp3" → "my song final". Keeps it readable without the file junk. */
export function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/^\d{1,3}\s*[-.)]\s*/, '').replace(/\s+/g, ' ').trim()
  return base || name
}

/** Index of the track after `current`, or undefined when the playlist is done. */
export function nextIndex(current: number, length: number, repeat: RepeatMode, order?: number[]): number | undefined {
  if (length === 0) return undefined
  if (repeat === 'one') return current
  const sequence = order && order.length === length ? order : Array.from({ length }, (_, index) => index)
  const position = sequence.indexOf(current)
  const next = position + 1
  if (next < length) return sequence[next]
  return repeat === 'all' ? sequence[0] : undefined
}

/** Index of the track before `current`. Wraps to the end. */
export function previousIndex(current: number, length: number, order?: number[]): number | undefined {
  if (length === 0) return undefined
  const sequence = order && order.length === length ? order : Array.from({ length }, (_, index) => index)
  const position = sequence.indexOf(current)
  return sequence[(position - 1 + length) % length]
}

/** A shuffled play order that starts with the current track, so shuffling doesn't skip the song you're on. */
export function shuffledOrder(length: number, first: number, random: () => number = Math.random): number[] {
  const rest = Array.from({ length }, (_, index) => index).filter((index) => index !== first)
  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[rest[index], rest[swap]] = [rest[swap], rest[index]]
  }
  return length > 0 && first >= 0 && first < length ? [first, ...rest] : rest
}
