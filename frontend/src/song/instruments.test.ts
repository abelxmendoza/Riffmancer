import { describe, expect, it } from 'vitest'
import { respondSong } from '../assistant/songBrain'
import { DEFAULT_KIT, DEFAULT_PATCH, DRUM_VOICES, getGenre } from '../beatmaker/genres'
import { applyEdit } from './edit'
import { generateSong } from './generate'
import { DRUM_SETS, drumSetUrl, getInstrument, INSTRUMENT_LIBRARY, instrumentSource, namedInstrument, SAMPLED_NOTES } from './instruments'
import { PALETTES, paletteFor, varyStructure } from './palettes'
import { applyKitSettings, applyPatchSettings, designKit, designPatch, instrumentPatch, parseSoundRequests } from './sound'
import { SONG_TOOLS } from './tools'

// Every bundled sound file (vite lists them without loading them).
const FILES = new Set(Object.keys(import.meta.glob('../../public/{instruments,drums}/**/*.mp3')).map((path) => path.replace('../../public', '')))
const existsSync = (path: string) => FILES.has(path)
const PUBLIC = ''

describe('recorded instruments', () => {
  it('ships every bundled instrument and drum kit the app points at', () => {
    for (const instrument of INSTRUMENT_LIBRARY.filter((item) => item.local)) {
      for (const note of SAMPLED_NOTES) expect(existsSync(`${PUBLIC}/instruments/${instrument.id}/${note}.mp3`), `${instrument.id} ${note}`).toBe(true)
    }
    for (const set of DRUM_SETS) for (const voice of DRUM_VOICES) expect(existsSync(`${PUBLIC}${drumSetUrl(set.id, voice)}`), `${set.id} ${voice}`).toBe(true)
  })

  it('loads bundled notes locally and the rest from the soundfont site', () => {
    expect(instrumentSource('distortion_guitar')).toMatchObject({ baseUrl: '/instruments/distortion_guitar/' })
    expect(instrumentSource('distortion_guitar')?.urls['F#2']).toBe('Gb2.mp3')
    expect(instrumentSource('banjo')?.baseUrl).toBe('https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/banjo-mp3/')
    expect(instrumentSource('kazoo')).toBeUndefined()
    expect(INSTRUMENT_LIBRARY).toHaveLength(128)
  })

  it('turns instrument words into recorded instruments, and synth words into synths', () => {
    expect(designPatch('distorted guitars', DEFAULT_PATCH, 'chords')?.patch.sample).toBe('distortion_guitar')
    expect(designPatch('picked bass, punchy', DEFAULT_PATCH, 'bass')?.patch.sample).toBe('electric_bass_pick')
    expect(designPatch('piano', DEFAULT_PATCH, 'chords')?.patch.sample).toBe('acoustic_grand_piano')
    expect(designPatch('acoustic guitar', DEFAULT_PATCH, 'chords')?.patch.sample).toBe('acoustic_guitar_steel')
    expect(designPatch('a banjo', DEFAULT_PATCH, 'lead')?.patch).toMatchObject({ sample: 'banjo', name: 'Banjo' })
    expect(designPatch('deep 808', { ...DEFAULT_PATCH, sample: 'piano' }, 'bass')?.patch.sample).toBeUndefined()
    // Describing words keep the instrument.
    const guitar = designPatch('distorted guitar', DEFAULT_PATCH, 'chords')!.patch
    expect(designPatch('darker', guitar, 'chords')?.patch.sample).toBe('distortion_guitar')
    expect(designKit('live drums', DEFAULT_KIT)?.kit.set).toBe('acoustic')
    expect(designKit('808 drums', DEFAULT_KIT)?.kit.set).toBe('tr808')
    expect(designKit('drum machine', { ...DEFAULT_KIT, set: 'acoustic' })?.kit.set).toBeUndefined()
  })

  it('reads any General MIDI instrument from a request', () => {
    expect(namedInstrument('add a harmonica')?.id).toBe('harmonica')
    expect(parseSoundRequests('make the lead a sitar')[0]).toMatchObject({ part: 'lead', instrument: 'sitar' })
    expect(parseSoundRequests('banjo')[0]).toMatchObject({ part: 'lead', instrument: 'banjo' })
  })

  it('takes exact instrument settings from the live AI', () => {
    expect(applyPatchSettings(DEFAULT_PATCH, { sample: 'violin' }).sample).toBe('violin')
    expect(applyPatchSettings({ ...DEFAULT_PATCH, sample: 'violin' }, { sample: 'synth' }).sample).toBeUndefined()
    expect(applyPatchSettings(DEFAULT_PATCH, { sample: '../../etc' }).sample).toBeUndefined()
    expect(applyKitSettings(DEFAULT_KIT, { set: 'tr808' }).set).toBe('tr808')
    expect(applyKitSettings(DEFAULT_KIT, { set: 'nope' }).set).toBeUndefined()
    expect(instrumentPatch('electric_bass_finger')).toMatchObject({ sample: 'electric_bass_finger', octave: -1 })
  })
})

describe('genre palettes', () => {
  it('every palette choice makes a sound', () => {
    for (const [genre, palette] of Object.entries(PALETTES)) {
      expect(getGenre(genre).id).toBe(genre)
      for (const part of ['bass', 'chords', 'lead'] as const) {
        for (const words of palette[part]) {
          const designed = designPatch(words, DEFAULT_PATCH, part)
          expect(designed, `${genre} ${part}: ${words}`).toBeDefined()
          if (designed?.patch.sample) expect(getInstrument(designed.patch.sample)?.local, words).toBe(true)
        }
      }
      for (const words of palette.drums) expect(designKit(words, DEFAULT_KIT), `${genre} drums: ${words}`).toBeDefined()
    }
  })

  it('gives guitar music real guitars and bass', () => {
    for (const genre of ['metal', 'punk']) {
      const real = paletteFor(genre).chords.filter((words) => designPatch(words, DEFAULT_PATCH, 'chords')?.patch.sample)
      expect(real.length).toBe(paletteFor(genre).chords.length)
    }
  })

  it('varies the song shape but keeps it a song', () => {
    const base = [{ kind: 'intro', bars: 4 }, { kind: 'verse', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'bridge', bars: 8 }, { kind: 'chorus', bars: 8 }, { kind: 'outro', bars: 4 }] as const
    let seed = 1
    const shapes = new Set<string>()
    for (let run = 0; run < 20; run += 1) {
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      const shape = varyStructure(base.map((item) => ({ ...item })), random)
      expect(shape.some((item) => item.kind === 'chorus')).toBe(true)
      shapes.add(shape.map((item) => `${item.kind}${item.bars}`).join(' '))
    }
    expect(shapes.size).toBeGreaterThan(3)
  })
})

describe('the Next button', () => {
  it('writes a totally different song in the same genre', () => {
    let song = generateSong('metal', { seed: 4 })
    const seen = new Set<string>()
    for (let press = 0; press < 6; press += 1) {
      const result = applyEdit(song, { type: 'next_song' })
      expect(result.song.genreId).toBe('metal')
      expect(result.song.title).not.toBe(song.title)
      expect(result.song.sounds.chords.name).not.toBe(song.sounds.chords.name)
      expect(result.summary).toMatch(/^something different: ".+", \d+ BPM in/)
      const { min, max } = getGenre('metal').bpm
      expect(result.song.bpm).toBeGreaterThanOrEqual(min)
      expect(result.song.bpm).toBeLessThanOrEqual(max)
      seen.add(`${result.song.sounds.bass.name}|${result.song.sounds.chords.name}|${result.song.bpm}`)
      song = result.song
    }
    expect(seen.size).toBe(6)
  })

  it('keeps a style', () => {
    const shoegaze = applyEdit(generateSong('post-punk', { seed: 2 }), { type: 'new_song', style: 'shoegaze' }).song
    expect(applyEdit(shoegaze, { type: 'next_song' }).song).toMatchObject({ genreId: 'post-punk', style: 'Shoegaze' })
  })

  it('new songs start with a band from the genre palette', () => {
    const song = applyEdit(generateSong('punk', { seed: 9 }), { type: 'new_song', genre: 'punk' }).song
    expect(song.sounds.chords.sample).toBeDefined()
    expect(song.kit.set).toBe('acoustic')
  })

  it('Fret hears "next" and "I don\'t like it", but not "another snare"', () => {
    const song = generateSong('punk', { seed: 1 })
    for (const text of ['next', 'Next!', "I don't like it", 'something totally different', 'nah, next one please', 'skip']) {
      expect(respondSong(text, song).edits, text).toEqual([{ type: 'next_song' }])
    }
    expect(respondSong('try another snare', song).edits).not.toEqual([{ type: 'next_song' }])
    expect(respondSong('something different, metal', song).edits[0]?.type).not.toBe('next_song')
    expect(respondSong('what instruments do you have?', song).text).toMatch(/acoustic and TR-808/)
  })
})

describe('set_instrument edit', () => {
  it('swaps who plays a part', () => {
    const song = generateSong('punk', { seed: 1 })
    const banjo = applyEdit(song, { type: 'set_instrument', part: 'lead', instrument: 'banjo' })
    expect(banjo.song.sounds.lead.sample).toBe('banjo')
    expect(banjo.summary).toBe('put the lead on banjo')
    expect(applyEdit(banjo.song, { type: 'set_instrument', part: 'lead', instrument: 'synth' }).song.sounds.lead.sample).toBeUndefined()
    const kit = applyEdit(song, { type: 'set_instrument', part: 'drums', instrument: 'TR-808' })
    expect(kit.song.kit.set).toBe('tr808')
    expect(applyEdit(kit.song, { type: 'set_instrument', part: 'drums', instrument: 'synth' }).song.kit.set).toBeUndefined()
    expect(() => applyEdit(song, { type: 'set_instrument', part: 'bass', instrument: 'kazoo' })).toThrow(/kazoo/)
  })

  it('is a tool the live AI can call', () => {
    const names = SONG_TOOLS.map((tool) => tool.name)
    expect(names).toContain('next_song')
    expect(names).toContain('set_instrument')
  })
})
