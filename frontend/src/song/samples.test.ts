import { describe, expect, it } from 'vitest'
import { respondSong } from '../assistant/songBrain'
import { applyEdit } from './edit'
import { generateSong } from './generate'
import { commercialOk, licenseOf, parseRemoveSamples, parseSampleRequest, sampleSearch, songCredits, toSampleRef, validSample, type SampleRef } from './samples'

const snare: SampleRef = {
  source: 'freesound', id: 123, name: 'Dirty snare 03', author: 'drummer', license: 'CC BY',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', page: 'https://freesound.org/people/drummer/sounds/123/',
  url: 'https://cdn.freesound.org/previews/0/123_456-hq.mp3', duration: 0.6,
}

describe('reading sample requests', () => {
  it('finds the drums and the describing words', () => {
    expect(parseSampleRequest('use a real snare')).toEqual({ voices: ['snare'], description: '' })
    expect(parseSampleRequest('find me a dirtier kick on freesound')).toEqual({ voices: ['kick'], description: 'dirtier' })
    expect(parseSampleRequest('Real recorded drums')).toEqual({ voices: ['kick', 'snare', 'closedHat'], description: '' })
    expect(parseSampleRequest('a real snare drum, trashy and loud')).toEqual({ voices: ['snare'], description: 'trashy and loud' })
    expect(parseSampleRequest('sampled open hat and crash')?.voices).toEqual(['openHat', 'crash'])
  })

  it('leaves other requests alone', () => {
    expect(parseSampleRequest('make the snare punchier')).toBeUndefined()
    expect(parseSampleRequest('a real banger')).toBeUndefined()
    expect(parseSampleRequest('back to synth drums')).toBeUndefined()
  })

  it('reads going back to the synth drums', () => {
    expect(parseRemoveSamples('back to synth drums')).toBe('all')
    expect(parseRemoveSamples('remove the snare sample')).toEqual(['snare'])
    expect(parseRemoveSamples('louder snare')).toBeUndefined()
  })
})

describe('Freesound search and licences', () => {
  it('searches single hits with release-safe licences by default', () => {
    const search = sampleSearch('kick', 'Deep, punchy!')
    expect(search.query).toBe('deep punchy kick drum')
    expect(search.filter).toContain('duration:[0.03 TO 2]')
    expect(search.filter).toContain('"Creative Commons 0" OR "Attribution")')
    expect(sampleSearch('crash', '', true).filter).toContain('Attribution NonCommercial')
  })

  it('reads licences and what they allow', () => {
    expect(licenseOf('http://creativecommons.org/publicdomain/zero/1.0/')).toBe('CC0')
    expect(licenseOf('https://creativecommons.org/licenses/by/4.0/')).toBe('CC BY')
    expect(licenseOf('https://creativecommons.org/licenses/by-nc/4.0/')).toBe('CC BY-NC')
    expect(commercialOk('CC BY')).toBe(true)
    expect(commercialOk('CC BY-NC')).toBe(false)
  })

  it('turns a Freesound hit into a sample and refuses other hosts', () => {
    const ref = toSampleRef({ id: 9, name: 'snare.wav', username: 'a', license: 'http://creativecommons.org/publicdomain/zero/1.0/', duration: 0.4, previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/previews/0/9_1-hq.mp3' } })
    expect(ref).toMatchObject({ name: 'snare', license: 'CC0', page: 'https://freesound.org/s/9/' })
    expect(validSample({ ...snare, url: 'https://evil.example/x.mp3' })).toBeUndefined()
    expect(songCredits({ snare })).toEqual(['"Dirty snare 03" by drummer (CC BY) https://freesound.org/people/drummer/sounds/123/'])
  })
})

describe('set_sample edit', () => {
  it('puts a real drum on and takes it off again', () => {
    const song = generateSong('punk', { seed: 3 })
    const on = applyEdit(song, { type: 'set_sample', voice: 'snare', sample: snare })
    expect(on.song.samples?.snare?.id).toBe(123)
    expect(on.summary).toBe('put a real snare on: "Dirty snare 03" by drummer (CC BY)')
    const off = applyEdit(on.song, { type: 'set_sample', voice: 'snare' })
    expect(off.song.samples).toBeUndefined()
    expect(() => applyEdit(song, { type: 'set_sample', voice: 'snare', sample: { ...snare, url: 'https://x.dev/a.mp3' } })).toThrow()
  })
})

describe('Fret and samples', () => {
  it('asks for a Freesound search', () => {
    const song = generateSong('metal', { seed: 2 })
    expect(respondSong('use a real snare, trashy', song).samples).toEqual({ voices: ['snare'], description: 'trashy', next: false })
    const withSample = applyEdit(song, { type: 'set_sample', voice: 'snare', sample: snare }).song
    expect(respondSong('try another snare', withSample).samples).toMatchObject({ voices: ['snare'], next: true })
    const back = respondSong('back to synth drums', withSample)
    expect(back.edits).toEqual([{ type: 'set_sample', voice: 'snare' }])
  })
})
