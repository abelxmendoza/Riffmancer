import { describe, expect, it } from 'vitest'
import { getBeatStatus, getStudioStatus } from './bus'
import { respond } from './engine'

const studio = { route: 'studio' as const, beat: getBeatStatus(), studio: getStudioStatus() }

describe('Fret in the Studio', () => {
  it('opens the Studio from anywhere', () => {
    expect(respond('open the studio', { ...studio, route: 'home' }).navigate).toBe('studio')
    expect(respond('I want to record my vocals', { ...studio, route: 'beats' }).navigate).toBe('studio')
  })

  it('records and stops', () => {
    expect(respond('record', studio).studioActions).toEqual([{ type: 'record', on: true }])
    expect(respond('stop recording', studio).studioActions).toEqual([{ type: 'record', on: false }])
    expect(respond('stop', studio).studioActions).toEqual([{ type: 'stop' }])
    expect(respond('play it back', studio).studioActions).toEqual([{ type: 'play' }])
  })

  it('loads presets and genres', () => {
    expect(respond('use the scream preset', studio).studioActions).toEqual([{ type: 'preset', id: 'metal-scream' }])
    expect(respond('give me a telephone voice', studio).studioActions).toEqual([{ type: 'preset', id: 'telephone' }])
    expect(respond('make the vocals reggaeton', studio).studioActions).toEqual([{ type: 'genre', id: 'reggaeton' }])
  })

  it('adds tracks, exports and sets up the session', () => {
    expect(respond('add a double track', studio).studioActions).toEqual([{ type: 'addTrack', role: 'double' }])
    expect(respond('add a scream track', studio).studioActions).toEqual([{ type: 'addTrack', role: 'scream' }])
    expect(respond('export the stems', studio).studioActions).toEqual([{ type: 'export', what: 'stems' }])
    expect(respond('bounce the mix', studio).studioActions).toEqual([{ type: 'export', what: 'mix' }])
    expect(respond('turn the click off', studio).studioActions).toEqual([{ type: 'metronome', on: false }])
    expect(respond('count in 2 bars', studio).studioActions).toEqual([{ type: 'countIn', bars: 2 }])
    expect(respond('tempo 95', studio).studioActions).toEqual([{ type: 'tempo', bpm: 95 }])
  })

  it('answers studio questions', () => {
    expect(respond('How do I fix latency?', studio).text).toMatch(/Latency fix/)
    expect(respond('what presets are there?', studio).text).toMatch(/Cold Baritone/)
    expect(respond('can it autotune my vocals?', studio).text).toMatch(/roadmap/)
  })

  it('still sends beat requests to the Beat Maker', () => {
    const reply = respond('make a metal beat', studio)
    expect(reply.navigate).toBe('beats')
    expect(reply.actions[0]).toEqual({ type: 'genre', id: 'metal' })
  })
})
