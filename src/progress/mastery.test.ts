import { describe, it, expect } from 'vitest';
import { levelOf, recordResult, masteryFor, LEVEL_THRESHOLDS } from './mastery';
import type { MasteryMap } from './mastery';

describe('mastery', () => {
  it('thresholds are [3, 6]', () => {
    expect(LEVEL_THRESHOLDS).toEqual([3, 6]);
  });

  it('unseen cards are level 0, unflagged', () => {
    const map: MasteryMap = {};
    expect(masteryFor(map, 'caber')).toEqual({ progress: 0, flagged: false });
    expect(levelOf(masteryFor(map, 'caber'))).toBe(0);
  });

  it('levels up at 3 and 6 progress', () => {
    expect(levelOf({ progress: 2, flagged: false })).toBe(0);
    expect(levelOf({ progress: 3, flagged: false })).toBe(1);
    expect(levelOf({ progress: 5, flagged: false })).toBe(1);
    expect(levelOf({ progress: 6, flagged: false })).toBe(2);
    expect(levelOf({ progress: 99, flagged: false })).toBe(2);
  });

  it('correct play increments progress and clears flag', () => {
    const map: MasteryMap = { caber: { progress: 1, flagged: true } };
    recordResult(map, 'caber', true);
    expect(map.caber).toEqual({ progress: 2, flagged: false });
  });

  it('failed play decrements progress (floor 0) and flags', () => {
    const map: MasteryMap = { caber: { progress: 1, flagged: false } };
    recordResult(map, 'caber', false);
    expect(map.caber).toEqual({ progress: 0, flagged: true });
    recordResult(map, 'caber', false);
    expect(map.caber.progress).toBe(0); // floored
  });

  it('recordResult creates entries for unseen cards', () => {
    const map: MasteryMap = {};
    recordResult(map, 'faro', true);
    expect(map.faro).toEqual({ progress: 1, flagged: false });
  });
});
