import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle, pick, weightedPick } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('shuffle returns a permutation without mutating input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(1));
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('pick returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(pick(arr, mulberry32(3)));
  });

  it('weightedPick respects weights', () => {
    const rng = mulberry32(9);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      const got = weightedPick(['a', 'b'], (x) => (x === 'a' ? 3 : 1), rng);
      counts[got as 'a' | 'b']++;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 2); // ~3:1 with slack
  });
});
