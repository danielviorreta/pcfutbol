/**
 * Seedable randomness for game simulation.
 *
 * All gameplay randomness goes through `random()`. Each save stores a seed;
 * `withSeed` runs a step (e.g. a round) from that seed and returns the next
 * one, so the same save and the same decisions always produce the same results.
 */

type RandomSource = () => number

/** mulberry32: small, fast 32-bit PRNG. Returns the generator and a reader for its state. */
function createGenerator(seed: number): { next: RandomSource; state: () => number } {
  let current = seed >>> 0
  return {
    next: () => {
      current = (current + 0x6d2b79f5) >>> 0
      let t = current
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
    },
    state: () => current,
  }
}

let source: RandomSource = Math.random

/** Uniform float in [0, 1). */
export function random(): number {
  return source()
}

/** Uniform integer in [0, maxExclusive). */
export function randomInt(maxExclusive: number): number {
  return Math.floor(random() * maxExclusive)
}

/** New seed for a fresh save (not itself reproducible). */
export function createSeed(): number {
  return Math.floor(Math.random() * 4_294_967_296) >>> 0
}

/** Runs `fn` with randomness drawn from `seed`; returns its value and the seed to store for next time. */
export function withSeed<T>(seed: number, fn: () => T): { value: T; nextSeed: number } {
  const generator = createGenerator(seed)
  const previous = source
  source = generator.next
  try {
    return { value: fn(), nextSeed: generator.state() }
  } finally {
    source = previous
  }
}

/** Test hook: replace the random source (pass null to restore). */
export function setRandomSource(next: RandomSource | null): void {
  source = next ?? Math.random
}
