/** Returns a value in [0, 1). All randomness in the engine flows through an Rng
 *  so tests are deterministic and runs are replayable. */
export type Rng = () => number;

/**
 * Creates a Mulberry32 PRNG seeded with the given value.
 * Note: the seed is truncated to uint32 via `>>> 0` before use.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  return arr[Math.floor(rng() * arr.length)];
}

export function weightedPick<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T {
  if (items.length === 0) throw new Error('weightedPick: empty array');
  const total = items.reduce((s, it) => s + weight(it), 0);
  if (total <= 0) throw new Error('weightedPick: total weight must be > 0');
  let roll = rng() * total;
  for (const it of items) {
    roll -= weight(it);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}
