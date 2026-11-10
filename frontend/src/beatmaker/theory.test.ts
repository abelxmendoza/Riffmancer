import { beforeEach, describe, expect, it } from 'vitest'
import { buildChord, chordLabel, inScale, midiToFrequency, scaleStepToMidi, snapToScale } from './theory'

describe('theory', () => {
  it('converts MIDI to frequency', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440)
    expect(midiToFrequency(57)).toBeCloseTo(220)
  })

  it('snaps every note into the key so nothing sounds wrong', () => {
    for (let note = 40; note < 90; note += 1) expect(inScale(snapToScale(note, 4, 'minor'), 4, 'minor')).toBe(true)
    expect(snapToScale(61, 0, 'major')).toBe(60)
    expect(snapToScale(64, 0, 'major')).toBe(64)
  })

  it('walks the scale step by step', () => {
    expect([0, 1, 2, 7].map((step) => scaleStepToMidi(step, 9, 'minor', 48))).toEqual([57, 59, 60, 69])
  })

  it('builds chords that only use notes from the key', () => {
    expect(buildChord(1, 4, 'minor', 'triad', 48)).toEqual([52, 55, 59])
    expect(buildChord(1, 4, 'phrygian', 'power', 48)).toEqual([52, 59, 64])
    expect(buildChord(2, 0, 'major', 'seventh', 48)).toEqual([50, 53, 57, 60])
  })

  it('names chords', () => {
    expect(chordLabel(1, 4, 'minor', 'triad')).toEqual({ name: 'Em', roman: 'i' })
    expect(chordLabel(6, 4, 'minor', 'triad')).toEqual({ name: 'C', roman: 'VI' })
    expect(chordLabel(1, 9, 'major', 'power')).toEqual({ name: 'A5', roman: 'I' })
    expect(chordLabel(7, 0, 'major', 'triad').roman).toBe('vii°')
  })
})
