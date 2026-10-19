export function randomAt(seed: number, cursor: number): number {
  let x = (seed + cursor * 0x6d2b79f5) | 0
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

export function shuffled<T>(items: T[], seed: number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomAt(seed, i + 19) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface WeightedItem<T> {
  item: T
  weight: number
}

/** Deterministic weighted sample without replacement. */
export function weightedSample<T>(items: WeightedItem<T>[], seed: number, count: number, cursor = 0): T[] {
  const pool = items.map((entry, index) => ({
    ...entry,
    key: randomAt(seed, cursor + index + 301) / Math.max(0.0001, entry.weight),
  }))
  return pool
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((entry) => entry.item)
}
