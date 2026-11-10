export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const

export type ScaleName = keyof typeof SCALES

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: 'Major (bright)',
  minor: 'Minor (dark)',
  dorian: 'Dorian (moody)',
  phrygian: 'Phrygian (heavy)',
  mixolydian: 'Mixolydian (rocking)',
  harmonicMinor: 'Harmonic minor (sinister)',
}

export type ChordVoicing = 'power' | 'triad' | 'seventh'

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function noteName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

const mod = (value: number, size: number) => ((value % size) + size) % size

/** Returns true when the pitch class of `midi` belongs to the scale built on `root`. */
export function inScale(midi: number, root: number, scale: ScaleName): boolean {
  return (SCALES[scale] as readonly number[]).includes(mod(midi - root, 12))
}

/**
 * Moves any note onto the nearest note of the scale so that a player can never hit a "wrong" note.
 * Ties resolve downward, which keeps snapped melodies from creeping upward.
 */
export function snapToScale(midi: number, root: number, scale: ScaleName): number {
  for (let distance = 0; distance <= 6; distance += 1) {
    if (inScale(midi - distance, root, scale)) return midi - distance
    if (inScale(midi + distance, root, scale)) return midi + distance
  }
  return midi
}

/** Converts a zero-based step through the scale (0 = root, 7 = root an octave up) to a MIDI note. */
export function scaleStepToMidi(step: number, root: number, scale: ScaleName, baseOctaveMidi: number): number {
  const intervals = SCALES[scale]
  const octave = Math.floor(step / intervals.length)
  return baseOctaveMidi + root + octave * 12 + intervals[mod(step, intervals.length)]
}

/** The MIDI note (in the octave starting at `baseMidi`) of the root of scale degree 1–7. */
export function degreeRoot(degree: number, root: number, scale: ScaleName, baseMidi: number): number {
  return scaleStepToMidi(degree - 1, root, scale, baseMidi)
}

/** Builds a chord on a 1-based scale degree using only notes from the scale. */
export function buildChord(degree: number, root: number, scale: ScaleName, voicing: ChordVoicing, baseMidi = 48): number[] {
  const step = degree - 1
  const bass = scaleStepToMidi(step, root, scale, baseMidi)
  if (voicing === 'power') return [bass, bass + 7, bass + 12]
  const notes = [0, 2, 4].map((offset) => scaleStepToMidi(step + offset, root, scale, baseMidi))
  if (voicing === 'seventh') notes.push(scaleStepToMidi(step + 6, root, scale, baseMidi))
  return notes
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Human-readable chord name, e.g. "Em" with roman numeral "i". */
export function chordLabel(degree: number, root: number, scale: ScaleName, voicing: ChordVoicing): { name: string; roman: string } {
  const [first, third, fifth] = buildChord(degree, root, scale, 'triad')
  const thirdSize = third - first
  const fifthSize = fifth - first
  const quality = fifthSize === 6 ? 'dim' : thirdSize === 3 ? 'm' : ''
  const letter = NOTE_NAMES[mod(first, 12)]
  const roman = ROMAN[degree - 1] ?? '?'
  const romanLabel = quality === 'm' || quality === 'dim' ? roman.toLowerCase() + (quality === 'dim' ? '°' : '') : roman
  if (voicing === 'power') return { name: `${letter}5`, roman: romanLabel }
  return { name: `${letter}${quality}`, roman: romanLabel }
}
