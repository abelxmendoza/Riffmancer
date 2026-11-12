import { describe, expect, it } from 'vitest'
import { applyEdits } from '../song/edit'
import { generateSong } from '../song/generate'
import { findTarget, respondSong } from './songBrain'

const song = generateSong('metal', { seed: 5 })

describe('respondSong', () => {
  it('writes a new song in the asked genre, tempo and key', () => {
    const reply = respondSong('make me a drum and bass track at 172 in F minor', undefined)
    expect(reply.edits).toEqual([{ type: 'new_song', genre: 'drum-and-bass', bpm: 172, root: 5, scale: 'minor' }])
    expect(reply.play).toEqual({ type: 'play' })
  })

  it('starts a song from just a genre when nothing is loaded', () => {
    expect(respondSong('reggaeton', undefined).edits[0]).toMatchObject({ type: 'new_song', genre: 'reggaeton' })
    expect(respondSong('hmm', undefined).unknown).toBe(true)
  })

  it('does not throw the song away for "make the beat faster"', () => {
    expect(respondSong('make the beat faster', song).edits).toEqual([{ type: 'set_tempo', delta: 10 }])
  })

  it('makes only the chorus heavier', () => {
    const reply = respondSong('make the chorus heavier', song)
    expect(reply.edits).toEqual([{ type: 'energy', direction: 'up', kind: 'chorus' }, { type: 'tone', tweak: 'heavier', part: 'chords' }])
  })

  it('understands specific sections', () => {
    expect(findTarget('second verse', song)).toEqual({ section: 4 })
    expect(findTarget('the last chorus', song)).toEqual({ section: 7 })
    expect(findTarget('verse 1', song)).toEqual({ section: 2 })
    expect(findTarget('the bridge', song)).toEqual({ kind: 'bridge' })
  })

  it('handles arrangement and part requests', () => {
    expect(respondSong('add a bridge', song).edits).toEqual([{ type: 'add_section', kind: 'bridge' }])
    expect(respondSong('cut the last chorus', song).edits).toEqual([{ type: 'remove_section', section: 7 }])
    expect(respondSong('new drums in the verse', song).edits).toEqual([{ type: 'regenerate', what: 'drums', kind: 'verse' }])
    expect(respondSong('no bass in the intro', song).edits).toEqual([{ type: 'parts', part: 'bass', on: false, kind: 'intro' }])
    expect(respondSong('half time breakdown', song).edits).toEqual([{ type: 'feel', feel: 'half', kind: 'breakdown' }])
    expect(respondSong('make it drum and bass', song).edits).toEqual([{ type: 'change_genre', genre: 'drum-and-bass' }])
  })

  it('every edit it makes applies cleanly', () => {
    const phrases = ['heavier chorus', 'chill the verse out', 'make it darker', 'brighter synth', 'surprise me', 'make the intro longer', 'add a fill', 'call it Grave Dancer', 'key of D minor', 'new melody', 'new chords for the chorus']
    for (const phrase of phrases) {
      const reply = respondSong(phrase, song)
      expect(reply.edits.length, phrase).toBeGreaterThan(0)
      expect(applyEdits(song, reply.edits).errors, phrase).toEqual([])
    }
  })

  it('handles playback and history', () => {
    expect(respondSong('undo', song).history).toBe('undo')
    expect(respondSong('play the chorus', song).play).toEqual({ type: 'play', section: 3 })
    expect(respondSong('loop the bridge', { ...song, sections: [...song.sections] }).play?.type).toBe('loop')
    expect(respondSong('stop', song).play).toEqual({ type: 'stop' })
  })

  it('hands unknown requests to the live AI', () => {
    expect(respondSong('make it sound like a rainy night in Berlin', song).unknown).toBe(true)
  })
})

describe('Suno-style requests', () => {
  const song = generateSong('post-punk', { seed: 11 })
  const edits = (text: string, current = song) => respondSong(text, current).edits

  it('makes a styled song with the sounds described', () => {
    const [edit] = edits('make a shoegaze song with fuzzy wide guitars and a deep sub bass at 120')
    expect(edit).toMatchObject({ type: 'new_song', style: 'shoegaze', bpm: 120 })
    expect(edit.type === 'new_song' && edit.sounds).toMatchObject({ chords: expect.stringContaining('guitars'), bass: expect.stringContaining('sub bass') })
  })

  it('reads "<style> beat with ..." as a new song even with a song loaded', () => {
    const [edit] = edits('dark trap beat with a gliding 808 and glassy bells')
    expect(edit).toMatchObject({ type: 'new_song', style: 'trap' })
    expect(edit.type === 'new_song' && Object.keys(edit.sounds ?? {}).sort()).toEqual(['bass', 'lead'])
  })

  it('says so when it does not know a genre, and still makes something', () => {
    const reply = respondSong('make a polka song', song)
    expect(reply.text).toMatch(/don't know "polka"/)
    expect(reply.unknown).toBe(true)
    expect(reply.edits[0].type).toBe('new_song')
  })

  it('restyles the current song', () => {
    expect(edits('make it synthwave')).toEqual([{ type: 'change_genre', style: 'synthwave' }])
    expect(edits('make it sound like techno')).toEqual([{ type: 'change_genre', style: 'techno' }])
  })

  it('turns instrument talk into sound design', () => {
    expect(edits('make the bass an 808')).toEqual([{ type: 'design_sound', part: 'bass', description: expect.stringContaining('808') }])
    expect(edits('piano chords')[0]).toMatchObject({ type: 'design_sound', part: 'chords' })
    expect(edits('glassy bells for the melody')[0]).toMatchObject({ type: 'design_sound', part: 'lead' })
    expect(edits('make the drums roomy and punchy')[0]).toMatchObject({ type: 'design_sound', part: 'drums' })
    expect(edits('guitars with no distortion')).toEqual([{ type: 'design_sound', part: 'chords', description: expect.stringContaining('clean') }])
  })

  it('keeps arrangement requests as they were', () => {
    expect(edits('heavier chorus').map((edit) => edit.type)).toEqual(['energy', 'tone'])
    expect(edits('make it darker')).toEqual([{ type: 'set_key', scale: 'minor' }])
    expect(edits('brighter synth')).toEqual([{ type: 'tone', tweak: 'brighter', part: 'all' }])
    expect(edits('new drums')).toEqual([{ type: 'regenerate', what: 'drums' }])
  })
})
