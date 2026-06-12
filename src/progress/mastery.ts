export interface CardMastery {
  progress: number; // cumulative clean plays, decremented on fails (floor 0)
  flagged: boolean; // failed recently → resurfaces with higher draw weight
}

export type MasteryMap = Record<string, CardMastery>;

/** progress >= 3 → level 1 (icon art), >= 6 → level 2 (glyph art). */
export const LEVEL_THRESHOLDS = [3, 6] as const;

export function masteryFor(map: MasteryMap, cardId: string): CardMastery {
  return map[cardId] ?? { progress: 0, flagged: false };
}

export function levelOf(m: CardMastery): 0 | 1 | 2 {
  if (m.progress >= LEVEL_THRESHOLDS[1]) return 2;
  if (m.progress >= LEVEL_THRESHOLDS[0]) return 1;
  return 0;
}

export function recordResult(map: MasteryMap, cardId: string, correct: boolean): void {
  const m = masteryFor(map, cardId);
  map[cardId] = correct
    ? { progress: m.progress + 1, flagged: false }
    : { progress: Math.max(0, m.progress - 1), flagged: true };
}
