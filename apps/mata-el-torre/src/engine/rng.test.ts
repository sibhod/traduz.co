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
    // must not be the identity permutation
    expect(out).not.toEqual([1, 2, 3, 4, 5]);
    // deterministic anchor: known output for seed 1
    expect(out).toEqual([5, 3, 2, 1, 4]);
  });

  it('pick returns an element of the array', () => {
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(pick(arr, mulberry32(3)));
  });

  it('pick throws on empty array', () => {
    expect(() => pick([], mulberry32(0))).toThrow(/empty/i);
  });

  it('weightedPick respects weights', () => {
    const rng = mulberry32(9);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      const got = weightedPick(['a', 'b'], (x) => (x === 'a' ? 3 : 1), rng);
      counts[got as 'a' | 'b']++;
    }
    // true ratio 3:1 → a ≈ 75%; allow generous slack
    expect(counts.a / 2000).toBeGreaterThan(0.68);
    expect(counts.a / 2000).toBeLessThan(0.82);
  });

  it('weightedPick throws when total weight is not positive', () => {
    expect(() => weightedPick(['a', 'b'], () => 0, mulberry32(1))).toThrow(/total weight/i);
  });
});
