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
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('traduzco: mastery data malformed, resetting');
      return {};
    }
    return parsed as MasteryMap;
  } catch (e) {
    console.warn('traduzco: mastery data corrupt, resetting', e);
    return {};
  }
}

export function saveMastery(store: StringStore, map: MasteryMap): void {
  try {
    store.setItem(MASTERY_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('traduzco: failed to save mastery', e);
  }
}
