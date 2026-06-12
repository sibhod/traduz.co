import type { MasteryMap } from './mastery';

/** Minimal storage seam — satisfied by window.localStorage and by in-memory fakes. */
export interface StringStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MASTERY_KEY = 'traduzco.mastery.v1';

export function loadMastery(store: StringStore): MasteryMap {
  try {
    const raw = store.getItem(MASTERY_KEY);
    return raw ? (JSON.parse(raw) as MasteryMap) : {};
  } catch {
    return {};
  }
}

export function saveMastery(store: StringStore, map: MasteryMap): void {
  store.setItem(MASTERY_KEY, JSON.stringify(map));
}
