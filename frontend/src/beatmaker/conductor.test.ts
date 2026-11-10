import { beforeEach, describe, expect, it } from 'vitest'
import { Conductor, quantizeStep, type BandSong } from './conductor'
import { getGenre } from './genres'
import { sessionForGenre } from './session'

function song(id = 'post-punk'): BandSong {
  const session = sessionForGenre(getGenre(id))
  return { genre: getGenre(id), grids: session.grids, variation: 'main', progression: session.progression, root: session.root, scale: session.scale, parts: session.parts }
}

const runBar = (conductor: Conductor) => Array.from({ length: 16 }, () => conductor.tick())

describe('Conductor', () => {
  it('moves through the chord progression one bar at a time', () => {
    const conductor = new Conductor(() => song())
    const degrees = Array.from({ length: 5 }, () => runBar(conductor)[0].degree)
    expect(degrees).toEqual([1, 6, 3, 7, 1])
  })

  it('follows the chord the player picked', () => {
    const conductor = new Conductor(() => song())
    conductor.liveDegree = 4
    expect(runBar(conductor)[0].degree).toBe(4)
    expect(runBar(conductor)[0].degree).toBe(4)
  })

  it('plays a fill on the next bar and then a crash', () => {
    const conductor = new Conductor(() => song())
    runBar(conductor)
    conductor.queueFill()
    const fillBar = runBar(conductor)
    expect(fillBar.every((tick) => tick.fill)).toBe(true)
    const after = runBar(conductor)
    expect(after[0].fill).toBe(false)
    expect(after[0].events).toContainEqual({ part: 'drums', voice: 'crash', velocity: 1 })
  })

  it('quantizes the transport position to the nearest 16th', () => {
    expect(quantizeStep(0, 192)).toBe(0)
    expect(quantizeStep(47, 192)).toBe(1)
    expect(quantizeStep(48 * 15 + 30, 192)).toBe(0)
  })
})
