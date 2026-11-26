import { describe, expect, it } from 'vitest'
import { random, withSeed } from './random'

describe('seeded random', () => {
  it('repeats the same sequence for the same seed', () => {
    const draw = () => Array.from({ length: 5 }, () => random())
    const first = withSeed(1234, draw)
    const second = withSeed(1234, draw)

    expect(first.value).toEqual(second.value)
    expect(first.nextSeed).toBe(second.nextSeed)
  })

  it('continues the sequence from the returned seed', () => {
    const all = withSeed(42, () => [random(), random()]).value
    const firstHalf = withSeed(42, () => random())
    const secondHalf = withSeed(firstHalf.nextSeed, () => random())

    expect([firstHalf.value, secondHalf.value]).toEqual(all)
  })

  it('draws values in [0, 1)', () => {
    const values = withSeed(7, () => Array.from({ length: 1000 }, () => random())).value
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
  })
})
