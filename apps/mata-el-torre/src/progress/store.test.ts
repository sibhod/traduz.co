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

  it('returns empty map when stored value parses to null', () => {
    const store = memStore({ [MASTERY_KEY]: 'null' });
    expect(loadMastery(store)).toEqual({});
  });

  it('returns empty map when stored value parses to an array', () => {
    const store = memStore({ [MASTERY_KEY]: '[1,2]' });
    expect(loadMastery(store)).toEqual({});
  });

  it('returns empty map when stored value parses to a string', () => {
    const store = memStore({ [MASTERY_KEY]: '"hi"' });
    expect(loadMastery(store)).toEqual({});
  });

  it('does not throw when setItem throws (e.g. QuotaExceededError)', () => {
    const throwingStore: StringStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveMastery(throwingStore, {})).not.toThrow();
  });
});
