import { describe, it, expect } from 'vitest';
import { loadMastery, saveMastery, MASTERY_KEY } from './store';
import type { StringStore } from './store';

function memStore(initial: Record<string, string> = {}): StringStore {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('mastery store', () => {
  it('round-trips a mastery map', () => {
    const store = memStore();
    saveMastery(store, { caber: { progress: 4, flagged: false } });
    expect(loadMastery(store)).toEqual({ caber: { progress: 4, flagged: false } });
  });

  it('returns empty map when nothing saved', () => {
    expect(loadMastery(memStore())).toEqual({});
  });

  it('returns empty map on corrupt JSON instead of throwing', () => {
    const store = memStore({ [MASTERY_KEY]: '{not json' });
    expect(loadMastery(store)).toEqual({});
  });
});
