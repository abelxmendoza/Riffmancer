/** Small seeded random generator (mulberry32) so generated songs are repeatable in tests. */
export type Random = () => number

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

/** The next seed after `seed`, so each edit gets fresh but repeatable randomness. */
export function nextSeed(seed: number): number {
  return Math.floor(seededRandom(seed)() * 2 ** 31)
}
