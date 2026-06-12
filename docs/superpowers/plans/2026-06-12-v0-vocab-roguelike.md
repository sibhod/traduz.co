# Traduzco v0 Vocabulary Roguelike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable vertical slice of the vocabulary roguelike — a 3-fight run where playing a card requires matching its association image to the correct Spanish word in a monster's thought bubbles, with mastery-driven card upgrades persisted in localStorage.

**Architecture:** Pure-TypeScript game logic (content, mastery, challenge, combat engine, run controller) with zero rendering dependencies, unit-tested with Vitest and driven by a seedable RNG. PixiJS v8 renders scenes (combat, reward, end) as a thin layer that calls engine functions and animates the events they return. Spec: `docs/superpowers/specs/2026-06-12-traduzco-vocab-roguelike-design.md`.

**Tech Stack:** TypeScript, Vite, PixiJS v8, Vitest. No backend; deck is JSON, mastery state in `localStorage`. v0 association art is emoji-composed (scene = 2-3 emoji, icon = 1 emoji, glyph = generated sigil); audio via browser `speechSynthesis` (Spanish voice). pnpm.

**PixiJS v8 API notes (differs from old Pixi):** `const app = new Application(); await app.init({...}); document.body.appendChild(app.canvas)`. Graphics chains: `g.roundRect(x,y,w,h,r).fill(0xRRGGBB).stroke({width,color})`. Text: `new Text({ text, style: {...} })`. Interactivity: `obj.eventMode = 'static'; obj.on('pointertap', fn)`.

---

## File Structure

```
index.html                      — Vite entry, mobile viewport meta
package.json / tsconfig.json / vite.config.ts
src/
  main.ts                       — bootstrap Pixi app + run-flow orchestration
  content/
    types.ts                    — CardDef, DeckDef
    seed-deck.json              — 15 hand-seeded B2-ish cards (emoji scenes)
    deck.ts                     — load + validate deck JSON
  engine/
    rng.ts                      — seedable PRNG (mulberry32) + shuffle/pick helpers
    config.ts                   — every tuning number in one place
    combat.ts                   — combat state machine (pure logic, emits events)
    run.ts                      — run controller: 3 fights, rewards, win/lose
  progress/
    mastery.ts                  — mastery levels + recordResult (pure logic)
    store.ts                    — localStorage persistence (injectable storage)
  challenge/
    types.ts                    — TapChallenge interface (the pluggable seam)
    tap-match.ts                — build 4-option challenge w/ devious distractors
  ui/
    layout.ts                   — 720×1280 virtual portrait coords, fit-scale
    cardView.ts                 — render a card face by mastery level (scene/icon/glyph)
    combatScene.ts              — enemy, thought bubbles, hand, HP/energy, wiring
    rewardScene.ts              — pick-a-card / heal between fights
    endScene.ts                 — victory & defeat screens
    juice.ts                    — tween helper, screen shake, floating damage numbers
    sfx.ts                      — WebAudio synth blips + speechSynthesis TTS
src/**/*.test.ts                — Vitest co-located tests (pure logic only)
```

UI files are verified manually in the browser (rendering isn't unit-tested); everything in `content/`, `engine/`, `progress/`, `challenge/` is TDD.

**Conventions:** all engine functions mutate a state object and return a `CombatEvent[]` for the UI to animate. No `Date.now()`/`Math.random()` inside engine code — RNG is always injected.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts` (stub)

- [ ] **Step 1: Author package.json**

```json
{
  "name": "traduzco",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm add pixi.js && pnpm add -D typescript vite vitest`
Expected: `pixi.js` resolves to ^8.x in package.json.

- [ ] **Step 3: Author tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Author vite.config.ts**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
});
```

- [ ] **Step 5: Author index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>traduzco</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #14101e; overflow: hidden; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Author stub src/main.ts (replaced in Task 8)**

```ts
console.log('traduzco v0');
```

- [ ] **Step 7: Verify dev server and test runner**

Run: `pnpm dev` → open `http://localhost:5173`, console shows `traduzco v0`. Ctrl-C.
Run: `pnpm test`
Expected: vitest exits cleanly with "No test files found" (this is fine — pass `--passWithNoTests`? No: just confirm it runs. If it exits non-zero, that's expected until Task 2 adds tests; proceed.)

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + PixiJS v8 + Vitest project"
```

---

### Task 2: Content layer — card types, seed deck, loader

**Files:**
- Create: `src/content/types.ts`, `src/content/seed-deck.json`, `src/content/deck.ts`
- Test: `src/content/deck.test.ts`

- [ ] **Step 1: Author src/content/types.ts**

```ts
/** A single vocabulary card. The association art is emoji-composed in v0:
 *  `scene` (2-3 emoji, mastery L0) → `icon` (1 emoji, L1) → generated glyph (L2). */
export interface CardDef {
  id: string; // accent-free slug, e.g. 'escalofrio'
  word: string; // display Spanish, article included for nouns, e.g. 'el escalofrío'
  partOfSpeech: 'verb' | 'noun' | 'adj' | 'phrase';
  scene: string; // emoji string, e.g. '🥶❄️😨'
  icon: string; // single emoji, e.g. '🥶'
  /** Card ids this word is personally/deviously confusable with (preferred distractors). */
  confusableWith?: string[];
}

export interface DeckDef {
  name: string;
  cards: CardDef[];
}
```

- [ ] **Step 2: Author src/content/seed-deck.json**

Placeholder seed scoped to *visually representable* B2-ish vocab per the spec's
abstract-word risk note. **Eric: swap in your own notebook words any time — this file is
the only thing to edit.**

```json
{
  "name": "Cuaderno v0",
  "cards": [
    { "id": "madrugar", "word": "madrugar", "partOfSpeech": "verb", "scene": "🌅⏰🥱", "icon": "⏰", "confusableWith": ["bostezo"] },
    { "id": "caber", "word": "caber", "partOfSpeech": "verb", "scene": "🚕👨‍👩‍👧‍👦🧳", "icon": "🚕", "confusableWith": ["apretar"] },
    { "id": "muchedumbre", "word": "la muchedumbre", "partOfSpeech": "noun", "scene": "🏟️👥🎤", "icon": "👥", "confusableWith": ["cosecha"] },
    { "id": "chubasco", "word": "el chubasco", "partOfSpeech": "noun", "scene": "⛈️☔🌊", "icon": "⛈️", "confusableWith": ["escalofrio"] },
    { "id": "derramar", "word": "derramar", "partOfSpeech": "verb", "scene": "🥛💦😬", "icon": "💦", "confusableWith": ["apretar"] },
    { "id": "cosecha", "word": "la cosecha", "partOfSpeech": "noun", "scene": "🌾👨‍🌾🧺", "icon": "🌾", "confusableWith": ["muchedumbre"] },
    { "id": "bostezo", "word": "el bostezo", "partOfSpeech": "noun", "scene": "🥱😴🛏️", "icon": "🥱", "confusableWith": ["susurro", "masticar"] },
    { "id": "masticar", "word": "masticar", "partOfSpeech": "verb", "scene": "🦷🍖😋", "icon": "🦷", "confusableWith": ["bostezo"] },
    { "id": "faro", "word": "el faro", "partOfSpeech": "noun", "scene": "🌊🚨⛵", "icon": "🚨" },
    { "id": "arruga", "word": "la arruga", "partOfSpeech": "noun", "scene": "👵🧴〰️", "icon": "〰️", "confusableWith": ["telarana"] },
    { "id": "hormigueo", "word": "el hormigueo", "partOfSpeech": "noun", "scene": "🐜🐜🦶", "icon": "🐜", "confusableWith": ["escalofrio"] },
    { "id": "apretar", "word": "apretar", "partOfSpeech": "verb", "scene": "✊🔧😣", "icon": "✊", "confusableWith": ["caber", "derramar"] },
    { "id": "escalofrio", "word": "el escalofrío", "partOfSpeech": "noun", "scene": "🥶❄️😨", "icon": "🥶", "confusableWith": ["hormigueo", "chubasco"] },
    { "id": "telarana", "word": "la telaraña", "partOfSpeech": "noun", "scene": "🕸️🕷️🏚️", "icon": "🕸️", "confusableWith": ["arruga"] },
    { "id": "susurro", "word": "el susurro", "partOfSpeech": "noun", "scene": "🤫👂🌙", "icon": "🤫", "confusableWith": ["bostezo"] }
  ]
}
```

- [ ] **Step 3: Write the failing test — src/content/deck.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { loadDeck } from './deck';
import seedJson from './seed-deck.json';

describe('loadDeck', () => {
  it('loads the seed deck with 15 valid cards', () => {
    const deck = loadDeck(seedJson);
    expect(deck.cards).toHaveLength(15);
    expect(deck.cards.every((c) => c.scene.length > 0 && c.icon.length > 0)).toBe(true);
  });

  it('rejects duplicate card ids', () => {
    const bad = { name: 'x', cards: [seedJson.cards[0], seedJson.cards[0]] };
    expect(() => loadDeck(bad)).toThrow(/duplicate/i);
  });

  it('rejects confusableWith references to unknown ids', () => {
    const bad = {
      name: 'x',
      cards: [{ ...seedJson.cards[0], confusableWith: ['nope'] }],
    };
    expect(() => loadDeck(bad)).toThrow(/unknown/i);
  });

  it('rejects decks too small to build 4-option challenges', () => {
    const bad = { name: 'x', cards: seedJson.cards.slice(0, 3) };
    expect(() => loadDeck(bad)).toThrow(/at least/i);
  });

  it('looks up cards by id', () => {
    const deck = loadDeck(seedJson);
    expect(deck.byId('caber').word).toBe('caber');
    expect(() => deck.byId('nope')).toThrow(/unknown card/i);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './deck'` (or similar).

- [ ] **Step 5: Implement src/content/deck.ts**

```ts
import type { CardDef, DeckDef } from './types';

export interface Deck extends DeckDef {
  byId(id: string): CardDef;
}

const MIN_CARDS = 4; // need 1 correct + 3 distractors

/** Validate raw JSON into a Deck. Throws with a descriptive message on invalid data. */
export function loadDeck(raw: unknown): Deck {
  const def = raw as DeckDef;
  if (!def || !Array.isArray(def.cards)) throw new Error('deck: missing cards array');
  if (def.cards.length < MIN_CARDS) {
    throw new Error(`deck: needs at least ${MIN_CARDS} cards, got ${def.cards.length}`);
  }
  const ids = new Set<string>();
  for (const c of def.cards) {
    if (!c.id || !c.word || !c.scene || !c.icon) {
      throw new Error(`deck: card missing required field: ${JSON.stringify(c)}`);
    }
    if (ids.has(c.id)) throw new Error(`deck: duplicate card id '${c.id}'`);
    ids.add(c.id);
  }
  for (const c of def.cards) {
    for (const ref of c.confusableWith ?? []) {
      if (!ids.has(ref)) throw new Error(`deck: card '${c.id}' references unknown id '${ref}'`);
    }
  }
  const index = new Map(def.cards.map((c) => [c.id, c]));
  return {
    name: def.name,
    cards: def.cards,
    byId(id: string): CardDef {
      const card = index.get(id);
      if (!card) throw new Error(`deck: unknown card id '${id}'`);
      return card;
    },
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/content/
git commit -m "feat: content layer — card types, seed deck, validated loader"
```

---

### Task 3: Seedable RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

- [ ] **Step 1: Write the failing test — src/engine/rng.test.ts**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './rng'.

- [ ] **Step 3: Implement src/engine/rng.ts**

```ts
/** Returns a value in [0, 1). All randomness in the engine flows through an Rng
 *  so tests are deterministic and runs are replayable. */
export type Rng = () => number;

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
  let roll = rng() * total;
  for (const it of items) {
    roll -= weight(it);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (all rng tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts
git commit -m "feat: seedable RNG (mulberry32) with shuffle/pick/weightedPick"
```

---

### Task 4: Mastery (SRS-in-disguise) + persistence

**Files:**
- Create: `src/progress/mastery.ts`, `src/progress/store.ts`
- Test: `src/progress/mastery.test.ts`, `src/progress/store.test.ts`

Mastery model: each card has `progress` (int ≥ 0) and `flagged` (failed recently, must
resurface). Level = 0 while progress < 3, 1 while < 6, 2 at 6+. Correct play: +1
progress, unflag. Failed play: -1 progress (floor 0), flag. Level drives damage AND which
art stage renders (scene → icon → glyph) — the scaffolding falling away.

- [ ] **Step 1: Write the failing test — src/progress/mastery.test.ts**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './mastery'.

- [ ] **Step 3: Implement src/progress/mastery.ts**

```ts
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
```

- [ ] **Step 4: Run mastery tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Write the failing test — src/progress/store.test.ts**

Storage is injected (a `StringStore` interface) so tests don't need jsdom and a future
backend can swap in transparently.

```ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './store'.

- [ ] **Step 7: Implement src/progress/store.ts**

```ts
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
```

- [ ] **Step 8: Run tests to verify all pass**

Run: `pnpm test`
Expected: PASS (mastery + store suites).

- [ ] **Step 9: Commit**

```bash
git add src/progress/
git commit -m "feat: mastery levels with SRS flagging and localStorage-seam persistence"
```

---

### Task 5: Challenge layer — tap-match with devious distractors

**Files:**
- Create: `src/challenge/types.ts`, `src/challenge/tap-match.ts`
- Test: `src/challenge/tap-match.test.ts`

This is the pluggable seam from the spec: a challenge presents options and the UI reports
the player's choice; the engine only consumes `TapChallenge`. Distractor preference
order: `confusableWith` (hand-tuned devious) → same part of speech → anything else.

- [ ] **Step 1: Write the failing test — src/challenge/tap-match.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { buildTapChallenge, OPTION_COUNT } from './tap-match';
import { loadDeck } from '../content/deck';
import { mulberry32 } from '../engine/rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);

describe('buildTapChallenge', () => {
  it('produces 4 unique options including the correct word', () => {
    const ch = buildTapChallenge(deck, 'caber', mulberry32(1));
    expect(ch.options).toHaveLength(OPTION_COUNT);
    expect(new Set(ch.options).size).toBe(OPTION_COUNT);
    expect(ch.options).toContain('caber');
    expect(ch.correctWord).toBe('caber');
    expect(ch.cardId).toBe('caber');
  });

  it('prefers confusableWith words as distractors', () => {
    // caber lists apretar; with 1 confusable and 3 slots it must always appear
    const ch = buildTapChallenge(deck, 'caber', mulberry32(2));
    expect(ch.options).toContain('apretar');
  });

  it('falls back to same part of speech, then anything', () => {
    // faro (noun, no confusableWith): all distractors should be deck words, none = faro
    const ch = buildTapChallenge(deck, 'faro', mulberry32(3));
    const distractors = ch.options.filter((o) => o !== 'el faro');
    expect(distractors).toHaveLength(3);
    const words = new Set(deck.cards.map((c) => c.word));
    expect(distractors.every((d) => words.has(d))).toBe(true);
  });

  it('shuffles option order across seeds', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      orders.add(buildTapChallenge(deck, 'caber', mulberry32(seed)).options.join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './tap-match'.

- [ ] **Step 3: Implement src/challenge/types.ts**

```ts
/** The pluggable challenge seam. v0 ships tap-match; tile-assembly and voice
 *  implement the same shape later: present something, get a pass/fail choice. */
export interface TapChallenge {
  cardId: string;
  /** Display words (article included), shuffled. Exactly one is correct. */
  options: string[];
  correctWord: string;
}
```

- [ ] **Step 4: Implement src/challenge/tap-match.ts**

```ts
import type { Deck } from '../content/deck';
import type { Rng } from '../engine/rng';
import { shuffle } from '../engine/rng';
import type { TapChallenge } from './types';

export const OPTION_COUNT = 4;

/** Build a 4-option word challenge for a card. Distractor preference:
 *  confusableWith (devious, hand-tuned) → same partOfSpeech → any other card. */
export function buildTapChallenge(deck: Deck, cardId: string, rng: Rng): TapChallenge {
  const target = deck.byId(cardId);
  const others = deck.cards.filter((c) => c.id !== cardId);

  const confusable = others.filter((c) => target.confusableWith?.includes(c.id));
  const samePos = others.filter(
    (c) => !confusable.includes(c) && c.partOfSpeech === target.partOfSpeech,
  );
  const rest = others.filter((c) => !confusable.includes(c) && !samePos.includes(c));

  const pool = [...shuffle(confusable, rng), ...shuffle(samePos, rng), ...shuffle(rest, rng)];
  const distractors = pool.slice(0, OPTION_COUNT - 1).map((c) => c.word);

  return {
    cardId,
    options: shuffle([target.word, ...distractors], rng),
    correctWord: target.word,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/challenge/
git commit -m "feat: tap-match challenge with confusable-first devious distractors"
```

---

### Task 6: Tuning config + combat engine

**Files:**
- Create: `src/engine/config.ts`, `src/engine/combat.ts`
- Test: `src/engine/combat.test.ts`

The combat state machine. Pure logic: mutates a `CombatState`, returns `CombatEvent[]`
that the UI animates. Phases: `awaitCard` (pick a card from hand) → `awaitChallenge`
(thought bubbles up) → back, until `victory`/`defeat`. Recall is the casting cost:
pass → damage scaled by mastery level; fail → fizzle + small self-hit (the spec's
counter-hit) and the card is flagged so it resurfaces via weighted draw.

- [ ] **Step 1: Author src/engine/config.ts (every tuning number — all playtest guesses)**

```ts
/** All tuning numbers live here. Every value is a starting guess to playtest. */
export const CONFIG = {
  playerMaxHp: 30,
  handSize: 5,
  energyPerTurn: 3,
  baseDamage: 4,
  damagePerLevel: 2, // L0=4, L1=6, L2=8
  fizzleSelfDamage: 2, // the counter-hit on a failed recall
  flaggedDrawWeight: 3, // flagged words 3x more likely to be drawn
  rewardHeal: 5,
  startingDeckSize: 10, // remaining seed cards form the reward reserve
  fights: [
    { name: 'Duendecillo', emoji: '👹', hp: 18, attack: 4 },
    { name: 'Lechuza', emoji: '🦉', hp: 24, attack: 5 },
    { name: 'La Catrina', emoji: '💀', hp: 30, attack: 6 },
  ],
} as const;

export type EnemyDef = (typeof CONFIG.fights)[number];
```

- [ ] **Step 2: Write the failing test — src/engine/combat.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { startCombat, playCard, resolveChallenge, endTurn } from './combat';
import type { CombatState } from './combat';
import { CONFIG } from './config';
import { loadDeck } from '../content/deck';
import { mulberry32 } from './rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);
const tenIds = deck.cards.slice(0, 10).map((c) => c.id);
const enemy = CONFIG.fights[0];

function freshCombat(seed = 1): CombatState {
  return startCombat({
    cardIds: tenIds,
    levels: {},
    flagged: new Set(),
    enemy,
    playerHp: CONFIG.playerMaxHp,
    rng: mulberry32(seed),
  }).state;
}

describe('combat', () => {
  it('starts in awaitCard with a full hand and full energy', () => {
    const s = freshCombat();
    expect(s.phase).toBe('awaitCard');
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.energy).toBe(CONFIG.energyPerTurn);
    expect(s.drawPile.length + s.hand.length).toBe(10);
  });

  it('playCard moves to awaitChallenge with a pending challenge for that card', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    expect(s.phase).toBe('awaitChallenge');
    expect(s.pending?.cardId).toBe(cardId);
    expect(s.pending?.options).toHaveLength(4);
  });

  it('correct answer deals level-scaled damage and discards the card', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    s.levels[cardId] = 1; // mastery level 1 → 4 + 2 = 6
    playCard(s, deck, cardId, mulberry32(2));
    const events = resolveChallenge(s, s.pending!.correctWord);
    expect(s.enemyHp).toBe(enemy.hp - (CONFIG.baseDamage + CONFIG.damagePerLevel));
    expect(s.discard).toContain(cardId);
    expect(s.hand).not.toContain(cardId);
    expect(s.energy).toBe(CONFIG.energyPerTurn - 1);
    expect(s.phase).toBe('awaitCard');
    expect(events.some((e) => e.type === 'challengePassed')).toBe(true);
  });

  it('wrong answer fizzles: no enemy damage, self-hit, card flagged', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    const wrong = s.pending!.options.find((o) => o !== s.pending!.correctWord)!;
    const events = resolveChallenge(s, wrong);
    expect(s.enemyHp).toBe(enemy.hp);
    expect(s.playerHp).toBe(CONFIG.playerMaxHp - CONFIG.fizzleSelfDamage);
    expect(s.flagged.has(cardId)).toBe(true);
    expect(events.some((e) => e.type === 'challengeFailed')).toBe(true);
  });

  it('reaching 0 enemy HP wins', () => {
    const s = freshCombat();
    s.enemyHp = 1;
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    const events = resolveChallenge(s, s.pending!.correctWord);
    expect(s.phase).toBe('victory');
    expect(events.some((e) => e.type === 'victory')).toBe(true);
  });

  it('endTurn: enemy attacks, hand refreshes, energy resets', () => {
    const s = freshCombat();
    const events = endTurn(s, mulberry32(3));
    expect(s.playerHp).toBe(CONFIG.playerMaxHp - enemy.attack);
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.energy).toBe(CONFIG.energyPerTurn);
    expect(events.some((e) => e.type === 'enemyAttack')).toBe(true);
  });

  it('reaching 0 player HP loses', () => {
    const s = freshCombat();
    s.playerHp = enemy.attack; // exactly lethal
    const events = endTurn(s, mulberry32(3));
    expect(s.phase).toBe('defeat');
    expect(events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('reshuffles discard into draw pile when draw pile runs dry', () => {
    const s = freshCombat();
    s.enemyHp = 999; // keep combat going long enough to cycle the 10-card deck
    // 10 cards, draw 5/turn + play 3/turn → draw pile is dry by turn 2's redraw
    for (let turn = 0; turn < 4; turn++) {
      while (s.energy > 0 && s.hand.length > 0) {
        const cardId = s.hand[0];
        playCard(s, deck, cardId, mulberry32(turn * 10 + s.energy));
        resolveChallenge(s, s.pending!.correctWord);
      }
      endTurn(s, mulberry32(turn));
    }
    // deck cycled at least once without throwing; hand refilled, state coherent
    expect(s.phase).toBe('awaitCard'); // 4 enemy hits of 4 dmg < 30 HP
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.drawPile.length + s.hand.length + s.discard.length).toBe(10);
  });

  it('playCard with no energy throws', () => {
    const s = freshCombat();
    s.energy = 0;
    expect(() => playCard(s, deck, s.hand[0], mulberry32(1))).toThrow(/energy/i);
  });

  it('flagged cards draw with higher weight', () => {
    // statistical: flag one card, count how often it lands in opening hand
    const flaggedId = tenIds[9];
    let appearances = 0;
    const trials = 300;
    for (let seed = 0; seed < trials; seed++) {
      const { state } = startCombat({
        cardIds: tenIds,
        levels: {},
        flagged: new Set([flaggedId]),
        enemy,
        playerHp: 30,
        rng: mulberry32(seed),
      });
      if (state.hand.includes(flaggedId)) appearances++;
    }
    // unweighted baseline would be 50% (5 of 10); 3x weight should push well above
    expect(appearances / trials).toBeGreaterThan(0.6);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './combat'.

- [ ] **Step 4: Implement src/engine/combat.ts**

```ts
import type { Deck } from '../content/deck';
import type { TapChallenge } from '../challenge/types';
import { buildTapChallenge } from '../challenge/tap-match';
import type { Rng } from './rng';
import { shuffle, weightedPick } from './rng';
import { CONFIG, type EnemyDef } from './config';

export type CombatPhase = 'awaitCard' | 'awaitChallenge' | 'victory' | 'defeat';

export interface CombatState {
  phase: CombatPhase;
  playerHp: number;
  enemyHp: number;
  enemy: EnemyDef;
  energy: number;
  drawPile: string[];
  hand: string[];
  discard: string[];
  pending: TapChallenge | null;
  /** Mastery level snapshot taken at combat start (levels change between fights). */
  levels: Record<string, number>;
  /** Failed-recall cards — drawn with CONFIG.flaggedDrawWeight. Mutated during combat. */
  flagged: Set<string>;
}

export type CombatEvent =
  | { type: 'cardsDrawn'; cardIds: string[] }
  | { type: 'cardPlayed'; cardId: string }
  | { type: 'challengePassed'; cardId: string; damage: number }
  | { type: 'challengeFailed'; cardId: string; correctWord: string }
  | { type: 'enemyAttack'; amount: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface StartCombatArgs {
  cardIds: string[];
  levels: Record<string, number>;
  flagged: Set<string>;
  enemy: EnemyDef;
  playerHp: number;
  rng: Rng;
}

export function damageFor(level: number): number {
  return CONFIG.baseDamage + CONFIG.damagePerLevel * level;
}

function drawOne(s: CombatState, rng: Rng): string | null {
  if (s.drawPile.length === 0) {
    if (s.discard.length === 0) return null;
    s.drawPile = shuffle(s.discard, rng);
    s.discard = [];
  }
  const id = weightedPick(s.drawPile, (c) => (s.flagged.has(c) ? CONFIG.flaggedDrawWeight : 1), rng);
  s.drawPile.splice(s.drawPile.indexOf(id), 1);
  return id;
}

function drawToHandSize(s: CombatState, rng: Rng): string[] {
  const drawn: string[] = [];
  while (s.hand.length < CONFIG.handSize) {
    const id = drawOne(s, rng);
    if (id === null) break; // deck smaller than hand — fine
    s.hand.push(id);
    drawn.push(id);
  }
  return drawn;
}

export function startCombat(args: StartCombatArgs): { state: CombatState; events: CombatEvent[] } {
  const state: CombatState = {
    phase: 'awaitCard',
    playerHp: args.playerHp,
    enemyHp: args.enemy.hp,
    enemy: args.enemy,
    energy: CONFIG.energyPerTurn,
    drawPile: shuffle(args.cardIds, args.rng),
    hand: [],
    discard: [],
    pending: null,
    levels: args.levels,
    flagged: args.flagged,
  };
  const drawn = drawToHandSize(state, args.rng);
  return { state, events: [{ type: 'cardsDrawn', cardIds: drawn }] };
}

export function playCard(s: CombatState, deck: Deck, cardId: string, rng: Rng): CombatEvent[] {
  if (s.phase !== 'awaitCard') throw new Error(`playCard: wrong phase '${s.phase}'`);
  if (s.energy <= 0) throw new Error('playCard: no energy left');
  if (!s.hand.includes(cardId)) throw new Error(`playCard: '${cardId}' not in hand`);
  s.pending = buildTapChallenge(deck, cardId, rng);
  s.phase = 'awaitChallenge';
  return [{ type: 'cardPlayed', cardId }];
}

export function resolveChallenge(s: CombatState, chosenWord: string): CombatEvent[] {
  if (s.phase !== 'awaitChallenge' || !s.pending) {
    throw new Error(`resolveChallenge: wrong phase '${s.phase}'`);
  }
  const { cardId, correctWord } = s.pending;
  const events: CombatEvent[] = [];

  s.hand.splice(s.hand.indexOf(cardId), 1);
  s.discard.push(cardId);
  s.energy -= 1;
  s.pending = null;

  if (chosenWord === correctWord) {
    const dmg = damageFor(s.levels[cardId] ?? 0);
    s.enemyHp = Math.max(0, s.enemyHp - dmg);
    events.push({ type: 'challengePassed', cardId, damage: dmg });
  } else {
    s.playerHp = Math.max(0, s.playerHp - CONFIG.fizzleSelfDamage);
    s.flagged.add(cardId);
    events.push({ type: 'challengeFailed', cardId, correctWord });
  }

  if (s.enemyHp <= 0) {
    s.phase = 'victory';
    events.push({ type: 'victory' });
  } else if (s.playerHp <= 0) {
    s.phase = 'defeat';
    events.push({ type: 'defeat' });
  } else {
    s.phase = 'awaitCard';
  }
  return events;
}

export function endTurn(s: CombatState, rng: Rng): CombatEvent[] {
  if (s.phase !== 'awaitCard') throw new Error(`endTurn: wrong phase '${s.phase}'`);
  const events: CombatEvent[] = [];

  s.playerHp = Math.max(0, s.playerHp - s.enemy.attack);
  events.push({ type: 'enemyAttack', amount: s.enemy.attack });

  if (s.playerHp <= 0) {
    s.phase = 'defeat';
    events.push({ type: 'defeat' });
    return events;
  }

  s.discard.push(...s.hand);
  s.hand = [];
  const drawn = drawToHandSize(s, rng);
  s.energy = CONFIG.energyPerTurn;
  events.push({ type: 'cardsDrawn', cardIds: drawn });
  return events;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS (all combat tests, all suites green).

- [ ] **Step 6: Commit**

```bash
git add src/engine/config.ts src/engine/combat.ts src/engine/combat.test.ts
git commit -m "feat: combat engine — recall-as-casting-cost state machine with events"
```

---

### Task 7: Run controller — 3 fights, rewards, completion

**Files:**
- Create: `src/engine/run.ts`
- Test: `src/engine/run.test.ts`

A run: fight CONFIG.fights[0..2] in order. Player HP persists across fights. After a
victory (except the last), the player picks a reward: **add one of 3 reserve cards** to
the deck, or **heal**. Defeat or final victory ends the run.

- [ ] **Step 1: Write the failing test — src/engine/run.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { startRun, rewardOptions, applyReward, advanceAfterVictory, markDefeat } from './run';
import { CONFIG } from './config';
import { loadDeck } from '../content/deck';
import { mulberry32 } from './rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);

describe('run', () => {
  it('starts at fight 0 with startingDeckSize cards and the rest in reserve', () => {
    const run = startRun(deck, mulberry32(1));
    expect(run.phase).toBe('combat');
    expect(run.fightIndex).toBe(0);
    expect(run.deckCardIds).toHaveLength(CONFIG.startingDeckSize);
    expect(run.reserveIds).toHaveLength(deck.cards.length - CONFIG.startingDeckSize);
    expect(run.playerHp).toBe(CONFIG.playerMaxHp);
  });

  it('victory on a non-final fight moves to reward phase', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 12); // hp after combat
    expect(run.phase).toBe('reward');
    expect(run.playerHp).toBe(12);
  });

  it('rewardOptions offers up to 3 reserve cards', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 20);
    const opts = rewardOptions(run, mulberry32(2));
    expect(opts.length).toBeLessThanOrEqual(3);
    expect(opts.every((id) => run.reserveIds.includes(id))).toBe(true);
  });

  it('applyReward(cardId) moves card from reserve to deck and starts next fight', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 20);
    const [choice] = rewardOptions(run, mulberry32(2));
    applyReward(run, choice);
    expect(run.deckCardIds).toContain(choice);
    expect(run.reserveIds).not.toContain(choice);
    expect(run.phase).toBe('combat');
    expect(run.fightIndex).toBe(1);
  });

  it("applyReward('heal') heals up to max and starts next fight", () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, CONFIG.playerMaxHp - 2); // heal should clamp
    applyReward(run, 'heal');
    expect(run.playerHp).toBe(CONFIG.playerMaxHp);
    expect(run.fightIndex).toBe(1);
  });

  it('victory on the final fight completes the run', () => {
    const run = startRun(deck, mulberry32(1));
    run.fightIndex = CONFIG.fights.length - 1;
    advanceAfterVictory(run, 5);
    expect(run.phase).toBe('complete');
  });

  it('markDefeat fails the run', () => {
    const run = startRun(deck, mulberry32(1));
    markDefeat(run);
    expect(run.phase).toBe('failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module './run'.

- [ ] **Step 3: Implement src/engine/run.ts**

```ts
import type { Deck } from '../content/deck';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { CONFIG } from './config';

export type RunPhase = 'combat' | 'reward' | 'complete' | 'failed';

export interface RunState {
  phase: RunPhase;
  fightIndex: number; // index into CONFIG.fights
  playerHp: number; // persists across fights
  deckCardIds: string[];
  reserveIds: string[]; // unplayed seed cards offered as rewards
}

export function startRun(deck: Deck, rng: Rng): RunState {
  const ids = shuffle(deck.cards.map((c) => c.id), rng);
  return {
    phase: 'combat',
    fightIndex: 0,
    playerHp: CONFIG.playerMaxHp,
    deckCardIds: ids.slice(0, CONFIG.startingDeckSize),
    reserveIds: ids.slice(CONFIG.startingDeckSize),
  };
}

/** Call after a combat victory with the player's remaining HP. */
export function advanceAfterVictory(run: RunState, playerHp: number): void {
  run.playerHp = playerHp;
  if (run.fightIndex >= CONFIG.fights.length - 1) {
    run.phase = 'complete';
  } else {
    run.phase = 'reward';
  }
}

export function rewardOptions(run: RunState, rng: Rng): string[] {
  return shuffle(run.reserveIds, rng).slice(0, 3);
}

/** choice: a reserve card id to add to the deck, or 'heal'. Starts the next fight. */
export function applyReward(run: RunState, choice: string | 'heal'): void {
  if (run.phase !== 'reward') throw new Error(`applyReward: wrong phase '${run.phase}'`);
  if (choice === 'heal') {
    run.playerHp = Math.min(CONFIG.playerMaxHp, run.playerHp + CONFIG.rewardHeal);
  } else {
    if (!run.reserveIds.includes(choice)) throw new Error(`applyReward: '${choice}' not in reserve`);
    run.reserveIds.splice(run.reserveIds.indexOf(choice), 1);
    run.deckCardIds.push(choice);
  }
  run.fightIndex += 1;
  run.phase = 'combat';
}

export function markDefeat(run: RunState): void {
  run.phase = 'failed';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/run.ts src/engine/run.test.ts
git commit -m "feat: run controller — 3 fights, card/heal rewards, completion states"
```

---

### Task 8: Pixi bootstrap — layout, card view, app shell

**Files:**
- Create: `src/ui/layout.ts`, `src/ui/cardView.ts`
- Modify: `src/main.ts` (replace stub)

Portrait-first: a fixed 720×1280 virtual canvas, fit-scaled and centered — phone and
desktop render identically. `cardView` renders a card face by mastery level: L0 full
emoji scene, L1 single icon, L2 abstract sigil (color/shape hashed from the card id — no
letters, no hints).

- [ ] **Step 1: Implement src/ui/layout.ts**

```ts
import { Container, type Application } from 'pixi.js';

export const VW = 720;
export const VH = 1280;

/** Returns the root container for all scenes, fit-scaled into the window and
 *  re-centered on resize. Everything in the game positions in 720×1280 coords. */
export function createViewport(app: Application): Container {
  const root = new Container();
  app.stage.addChild(root);
  const fit = () => {
    const scale = Math.min(app.screen.width / VW, app.screen.height / VH);
    root.scale.set(scale);
    root.x = (app.screen.width - VW * scale) / 2;
    root.y = (app.screen.height - VH * scale) / 2;
  };
  fit();
  app.renderer.on('resize', fit);
  return root;
}
```

- [ ] **Step 2: Implement src/ui/cardView.ts**

```ts
import { Container, Graphics, Text } from 'pixi.js';
import type { CardDef } from '../content/types';
import { damageFor } from '../engine/combat';

export const CARD_W = 128;
export const CARD_H = 176;

/** Deterministic sigil parameters from a card id — pure abstraction, no letter hints. */
function sigilFor(id: string): { color: number; sides: number } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const hue = h % 360;
  // crude HSL→RGB at fixed s/l for vivid distinct colors
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.55 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  const color = (f(0) << 16) | (f(8) << 8) | f(4);
  return { color, sides: 3 + (h % 4) }; // triangle..hexagon
}

function drawSigil(g: Graphics, id: string, cx: number, cy: number, r: number): void {
  const { color, sides } = sigilFor(id);
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  g.poly(pts).fill(color).stroke({ width: 3, color: 0xffffff, alpha: 0.6 });
}

/** Render a card face for a mastery level: 0 = scene (full scaffolding),
 *  1 = icon, 2 = sigil (scaffolding gone — pure recall). */
export function makeCardView(card: CardDef, level: 0 | 1 | 2): Container {
  const c = new Container();
  const bg = new Graphics()
    .roundRect(0, 0, CARD_W, CARD_H, 12)
    .fill(0x2a2440)
    .stroke({ width: 3, color: [0x8a7f5c, 0xc0c0c0, 0xffd700][level] });
  c.addChild(bg);

  if (level === 2) {
    const g = new Graphics();
    drawSigil(g, card.id, CARD_W / 2, CARD_H / 2 - 10, 42);
    c.addChild(g);
  } else {
    const art = new Text({
      text: level === 0 ? card.scene : card.icon,
      style: { fontSize: level === 0 ? 36 : 64 },
    });
    art.anchor.set(0.5);
    art.x = CARD_W / 2;
    art.y = CARD_H / 2 - 10;
    c.addChild(art);
  }

  const dmg = new Text({
    text: `⚔ ${damageFor(level)}`,
    style: { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' },
  });
  dmg.anchor.set(0.5);
  dmg.x = CARD_W / 2;
  dmg.y = CARD_H - 22;
  c.addChild(dmg);
  return c;
}
```

- [ ] **Step 3: Replace src/main.ts with the Pixi shell (temporary card showcase)**

```ts
import { Application } from 'pixi.js';
import { createViewport, VW } from './ui/layout';
import { makeCardView, CARD_W } from './ui/cardView';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  // TEMP showcase (replaced in Task 9): one card at each mastery level
  const deck = loadDeck(seedJson);
  ([0, 1, 2] as const).forEach((level, i) => {
    const v = makeCardView(deck.byId('caber'), level);
    v.x = VW / 2 - CARD_W / 2 + (i - 1) * (CARD_W + 24);
    v.y = 500;
    root.addChild(v);
  });
})();
```

- [ ] **Step 4: Manual verification**

Run: `pnpm dev` → open `http://localhost:5173`.
Expected: dark purple page, three card frames side by side — left shows 🚕👨‍👩‍👧‍👦🧳 (bronze
border), middle a large 🚕 (silver), right an abstract colored polygon (gold), each with
a ⚔ damage label (4 / 6 / 8). Resize the window — layout stays centered and scaled.
Also open from your phone via the LAN URL Vite prints — same layout, portrait.

- [ ] **Step 5: Run full test suite (no regressions)**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/layout.ts src/ui/cardView.ts src/main.ts
git commit -m "feat: Pixi v8 shell — fit-scaled portrait viewport and mastery-staged card faces"
```

---

### Task 9: Combat scene — enemy, thought bubbles, hand, wiring

**Files:**
- Create: `src/ui/combatScene.ts`
- Modify: `src/main.ts`

The diegetic challenge from the spec: tap a hand card → the monster sprouts 4 word
thought-bubbles → tap the matching bubble to land the blow. Renders from `CombatState`,
animates from `CombatEvent[]`. Juice hooks land in Task 10 — this task is correct play.

- [ ] **Step 1: Implement src/ui/combatScene.ts**

```ts
import { Container, Graphics, Text } from 'pixi.js';
import type { Deck } from '../content/deck';
import type { CombatState, CombatEvent } from '../engine/combat';
import { playCard, resolveChallenge, endTurn } from '../engine/combat';
import type { Rng } from '../engine/rng';
import { CONFIG } from '../engine/config';
import { makeCardView, CARD_W, CARD_H } from './cardView';
import { VW, VH } from './layout';

export interface CombatCallbacks {
  /** Fired for every engine event so juice/sfx/mastery can react (Tasks 10-11). */
  onEvents(events: CombatEvent[]): void;
  onCombatEnd(victory: boolean, playerHp: number): void;
}

const ENEMY_Y = 320;
const BUBBLE_W = 280;
const BUBBLE_H = 64;
const HAND_Y = VH - CARD_H - 40;

export class CombatScene {
  readonly view = new Container();
  /** Exposed so juice can shake it (Task 10). */
  readonly shakeLayer = new Container();

  private hud = new Container();
  private enemyArt!: Text;
  private bubbleLayer = new Container();
  private handLayer = new Container();
  private levelFor: (cardId: string) => 0 | 1 | 2;

  constructor(
    private state: CombatState,
    private deck: Deck,
    private rng: Rng,
    private cb: CombatCallbacks,
    levelFor: (cardId: string) => 0 | 1 | 2,
  ) {
    this.levelFor = levelFor;
    this.view.addChild(this.shakeLayer);
    this.shakeLayer.addChild(this.hud, this.bubbleLayer, this.handLayer);
    this.buildEnemy();
    this.buildEndTurnButton();
    this.render();
  }

  private buildEnemy(): void {
    this.enemyArt = new Text({ text: this.state.enemy.emoji, style: { fontSize: 160 } });
    this.enemyArt.anchor.set(0.5);
    this.enemyArt.x = VW / 2;
    this.enemyArt.y = ENEMY_Y;
    this.hud.addChild(this.enemyArt);

    const name = new Text({
      text: this.state.enemy.name,
      style: { fontSize: 28, fill: 0xddddee, fontWeight: 'bold' },
    });
    name.anchor.set(0.5);
    name.x = VW / 2;
    name.y = ENEMY_Y - 130;
    this.hud.addChild(name);
  }

  private buildEndTurnButton(): void {
    const btn = new Container();
    btn.addChild(
      new Graphics().roundRect(0, 0, 180, 56, 10).fill(0x4a3f6b).stroke({ width: 2, color: 0x9988cc }),
    );
    const label = new Text({ text: 'Fin del turno', style: { fontSize: 22, fill: 0xffffff } });
    label.anchor.set(0.5);
    label.x = 90;
    label.y = 28;
    btn.addChild(label);
    btn.x = VW - 200;
    btn.y = HAND_Y - 80;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      if (this.state.phase !== 'awaitCard') return;
      this.dispatch(endTurn(this.state, this.rng));
    });
    this.hud.addChild(btn);
  }

  private dispatch(events: CombatEvent[]): void {
    this.cb.onEvents(events);
    this.render();
    for (const e of events) {
      if (e.type === 'victory') this.cb.onCombatEnd(true, this.state.playerHp);
      if (e.type === 'defeat') this.cb.onCombatEnd(false, this.state.playerHp);
    }
  }

  /** Full redraw of dynamic parts. Spartan but correct; tween polish is Task 10. */
  private render(): void {
    this.renderBars();
    this.renderBubbles();
    this.renderHand();
  }

  private bars = new Container();
  private renderBars(): void {
    this.bars.removeChildren();
    if (!this.bars.parent) this.hud.addChild(this.bars);

    const bar = (x: number, y: number, w: number, frac: number, color: number, text: string) => {
      const g = new Graphics()
        .roundRect(x, y, w, 26, 6).fill(0x221c33)
        .roundRect(x, y, Math.max(0, w * frac), 26, 6).fill(color);
      this.bars.addChild(g);
      const t = new Text({ text, style: { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' } });
      t.anchor.set(0.5);
      t.x = x + w / 2;
      t.y = y + 13;
      this.bars.addChild(t);
    };
    bar(VW / 2 - 150, ENEMY_Y + 110, 300, this.state.enemyHp / this.state.enemy.hp, 0xcc3344,
      `${this.state.enemyHp}/${this.state.enemy.hp}`);
    bar(40, HAND_Y - 80, 260, this.state.playerHp / CONFIG.playerMaxHp, 0x33aa55,
      `❤ ${this.state.playerHp}/${CONFIG.playerMaxHp}`);

    const pips = new Text({
      text: '⚡'.repeat(this.state.energy) + '·'.repeat(CONFIG.energyPerTurn - this.state.energy),
      style: { fontSize: 30, fill: 0xffdd44 },
    });
    pips.x = 40;
    pips.y = HAND_Y - 130;
    this.bars.addChild(pips);
  }

  private renderBubbles(): void {
    this.bubbleLayer.removeChildren();
    const pending = this.state.pending;
    if (!pending) return;
    // 2×2 thought-bubble grid around the enemy
    pending.options.forEach((word, i) => {
      const bub = new Container();
      bub.addChild(
        new Graphics()
          .roundRect(0, 0, BUBBLE_W, BUBBLE_H, 28)
          .fill(0xf4f0e8)
          .stroke({ width: 3, color: 0xbbb29e }),
      );
      const t = new Text({ text: word, style: { fontSize: 26, fill: 0x221c33, fontWeight: 'bold' } });
      t.anchor.set(0.5);
      t.x = BUBBLE_W / 2;
      t.y = BUBBLE_H / 2;
      bub.addChild(t);
      bub.x = i % 2 === 0 ? VW / 2 - BUBBLE_W - 20 : VW / 2 + 20;
      bub.y = ENEMY_Y + 170 + Math.floor(i / 2) * (BUBBLE_H + 18);
      bub.eventMode = 'static';
      bub.cursor = 'pointer';
      bub.on('pointertap', () => this.dispatch(resolveChallenge(this.state, word)));
      this.bubbleLayer.addChild(bub);
    });
  }

  private renderHand(): void {
    this.handLayer.removeChildren();
    const n = this.state.hand.length;
    const totalW = n * CARD_W + (n - 1) * 12;
    this.state.hand.forEach((cardId, i) => {
      const v = makeCardView(this.deck.byId(cardId), this.levelFor(cardId));
      v.x = VW / 2 - totalW / 2 + i * (CARD_W + 12);
      v.y = HAND_Y;
      const playable = this.state.phase === 'awaitCard' && this.state.energy > 0;
      v.alpha = playable ? 1 : 0.5;
      if (playable) {
        v.eventMode = 'static';
        v.cursor = 'pointer';
        v.on('pointertap', () => this.dispatch(playCard(this.state, this.deck, cardId, this.rng)));
      }
      // highlight the card awaiting its challenge
      if (this.state.pending?.cardId === cardId) v.y -= 24;
      this.handLayer.addChild(v);
    });
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
```

**Note:** when a challenge is pending the played card stays in hand (raised 24px) until
`resolveChallenge` discards it — `renderHand` runs on every dispatch so the discard is
reflected on the next render.

- [ ] **Step 2: Wire one fight in src/main.ts (replaces the Task 8 showcase)**

```ts
import { Application } from 'pixi.js';
import { createViewport } from './ui/layout';
import { CombatScene } from './ui/combatScene';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';
import { startCombat } from './engine/combat';
import { startRun } from './engine/run';
import { CONFIG } from './engine/config';
import { mulberry32 } from './engine/rng';
import { loadMastery } from './progress/store';
import { levelOf, masteryFor } from './progress/mastery';

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  const deck = loadDeck(seedJson);
  const mastery = loadMastery(window.localStorage);
  const rng = mulberry32(Math.floor(performance.now())); // seed per session

  // TEMP: single fight only — full run flow lands in Task 11
  const run = startRun(deck, rng);
  const levels = Object.fromEntries(
    run.deckCardIds.map((id) => [id, levelOf(masteryFor(mastery, id))]),
  );
  const { state } = startCombat({
    cardIds: run.deckCardIds,
    levels,
    flagged: new Set(),
    enemy: CONFIG.fights[0],
    playerHp: run.playerHp,
    rng,
  });
  const scene = new CombatScene(state, deck, rng, {
    onEvents: (events) => console.log(events),
    onCombatEnd: (victory) => alert(victory ? '¡Victoria!' : 'Derrota...'),
  }, (cardId) => levelOf(masteryFor(mastery, cardId)));
  root.addChild(scene.view);
})();
```

- [ ] **Step 3: Manual verification (the core loop, end to end)**

Run: `pnpm dev`, open the page (desktop + phone):
1. Enemy 👹 "Duendecillo" top-center with red HP bar; 5 cards across the bottom; ⚡⚡⚡ pips; green player HP bar; "Fin del turno" button.
2. Tap a card → it raises 24px; 4 cream thought-bubbles appear under the enemy, one containing the right word for the card's emoji scene.
3. Tap the **correct** bubble → enemy HP drops by the card's ⚔ value, card leaves hand, one ⚡ spent.
4. Tap a card, then a **wrong** bubble → enemy HP unchanged, your HP drops by 2.
5. Spend all 3 ⚡ → remaining cards dim, only "Fin del turno" works.
6. End turn → your HP drops by 4, fresh hand of 5, ⚡ restored.
7. Kill the enemy → `¡Victoria!` alert. Die → `Derrota...` alert.

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: PASS (engine untouched).

- [ ] **Step 5: Commit**

```bash
git add src/ui/combatScene.ts src/main.ts
git commit -m "feat: combat scene — diegetic thought-bubble challenges, hand, HUD"
```

---

### Task 10: Juice — tweens, screen shake, damage numbers, SFX, TTS

**Files:**
- Create: `src/ui/juice.ts`, `src/ui/sfx.ts`
- Modify: `src/ui/combatScene.ts`, `src/main.ts`

Game feel is what the POC tests — this task is not optional polish. A ~40-line tween
helper (no dependency), shake on hits, floating damage numbers, synth SFX, and the card's
Spanish word spoken aloud (free listening reinforcement) on a successful play.

- [ ] **Step 1: Implement src/ui/juice.ts**

```ts
import { Container, Text, Ticker } from 'pixi.js';

type Ease = (t: number) => number;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

/** Minimal tween: animates numeric props on any object over ms using the shared ticker. */
export function tween<T extends Record<string, any>>(
  obj: T,
  to: Partial<Record<keyof T, number>>,
  ms: number,
  ease: Ease = easeOutCubic,
  onDone?: () => void,
): void {
  const from: Record<string, number> = {};
  for (const k of Object.keys(to)) from[k] = obj[k as keyof T] as number;
  let elapsed = 0;
  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / ms);
    const e = ease(t);
    for (const k of Object.keys(to)) {
      (obj as any)[k] = from[k] + ((to as any)[k] - from[k]) * e;
    }
    if (t >= 1) {
      Ticker.shared.remove(tick);
      onDone?.();
    }
  };
  Ticker.shared.add(tick);
}

/** Screen shake: jitters a container for durationMs, decaying, then recenters. */
export function shake(target: Container, intensity = 12, durationMs = 250): void {
  let elapsed = 0;
  const baseX = target.x;
  const baseY = target.y;
  const tick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const decay = 1 - elapsed / durationMs;
    if (decay <= 0) {
      target.x = baseX;
      target.y = baseY;
      Ticker.shared.remove(tick);
      return;
    }
    target.x = baseX + (Math.random() * 2 - 1) * intensity * decay;
    target.y = baseY + (Math.random() * 2 - 1) * intensity * decay;
  };
  Ticker.shared.add(tick);
}

/** Floating damage/heal number that drifts up and fades. */
export function floatNumber(parent: Container, x: number, y: number, text: string, color: number): void {
  const t = new Text({
    text,
    style: { fontSize: 44, fill: color, fontWeight: 'bold', stroke: { color: 0x000000, width: 5 } },
  });
  t.anchor.set(0.5);
  t.x = x;
  t.y = y;
  parent.addChild(t);
  tween(t, { y: y - 90, alpha: 0 }, 700, easeOutCubic, () => t.destroy());
}
```

- [ ] **Step 2: Implement src/ui/sfx.ts**

```ts
/** Tiny WebAudio synth — zero assets. Each call is a short shaped oscillator blip. */
let ctx: AudioContext | null = null;
function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume(); // unlocks on first user gesture
  return ctx;
}

function blip(freq: number, ms: number, type: OscillatorType, toFreq?: number, gainPeak = 0.15): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, ac.currentTime + ms / 1000);
  gain.gain.setValueAtTime(gainPeak, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + ms / 1000);
}

export const sfx = {
  hit: () => blip(220, 160, 'square', 110),
  fizzle: () => blip(330, 350, 'sawtooth', 82),
  draw: () => blip(660, 60, 'triangle'),
  enemyAttack: () => blip(140, 250, 'square', 70),
  victory: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 180, 'triangle'), i * 110)),
  defeat: () => [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 260, 'sawtooth'), i * 160)),
};

/** Speak a Spanish word via the browser's TTS — free listening reinforcement. */
export function speakSpanish(word: string): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === 'es-MX') ?? voices.find((v) => v.lang.startsWith('es')) ?? null;
  u.lang = u.voice?.lang ?? 'es-MX';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
```

- [ ] **Step 3: Wire juice into the combat flow**

In `src/main.ts`, replace the `onEvents: (events) => console.log(events)` callback with a
real handler (imports added at top of file:
`import { shake, floatNumber } from './ui/juice'; import { sfx, speakSpanish } from './ui/sfx';`).
The handler references `scene`, which is declared just above it — `handleEvents` is a
hoisted function declaration, and events only fire on user input long after both exist,
so no changes to `CombatScene` are needed:

```ts
const scene = new CombatScene(state, deck, rng, {
  onEvents: (events) => handleEvents(events),
  onCombatEnd: (victory) => alert(victory ? '¡Victoria!' : 'Derrota...'),
}, (cardId) => levelOf(masteryFor(mastery, cardId)));
root.addChild(scene.view);

function handleEvents(events: import('./engine/combat').CombatEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'challengePassed': {
        sfx.hit();
        speakSpanish(deck.byId(e.cardId).word);
        shake(scene.shakeLayer, 14, 280);
        floatNumber(scene.view, 360, 320, `-${e.damage}`, 0xffdd44);
        break;
      }
      case 'challengeFailed': {
        sfx.fizzle();
        speakSpanish(e.correctWord); // hear what it *should* have been — the lesson lands
        floatNumber(scene.view, 360, 320, e.correctWord, 0xff6666);
        break;
      }
      case 'enemyAttack': {
        sfx.enemyAttack();
        shake(scene.shakeLayer, 10, 220);
        floatNumber(scene.view, 170, 1000, `-${e.amount}`, 0xff4444);
        break;
      }
      case 'cardsDrawn':
        sfx.draw();
        break;
      case 'victory':
        sfx.victory();
        break;
      case 'defeat':
        sfx.defeat();
        break;
    }
  }
}
```

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`. Play a fight:
- Correct bubble → punchy hit sound, screen shakes, golden `-N` floats off the enemy, **the word is spoken in Spanish**.
- Wrong bubble → sour fizzle sound, the correct word floats in red and is spoken (you hear what you missed).
- End turn → thud + shake + red damage number near your HP bar.
- Victory/defeat → arpeggio/dirge.
Confirm sound works on the phone too (iOS requires the first tap to unlock audio — the `resume()` in `audio()` handles it).

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/juice.ts src/ui/sfx.ts src/ui/combatScene.ts src/main.ts
git commit -m "feat: juice — shake, damage numbers, synth SFX, Spanish TTS on plays"
```

---

### Task 11: Full run flow — rewards, end screens, mastery persistence

**Files:**
- Create: `src/ui/rewardScene.ts`, `src/ui/endScene.ts`
- Modify: `src/main.ts`

Ties everything together: 3 fights with the reward screen between, mastery recorded and
persisted on every challenge result, victory/defeat screens with "New run". After this
task the game is the complete v0 loop.

- [ ] **Step 1: Implement src/ui/rewardScene.ts**

```ts
import { Container, Graphics, Text } from 'pixi.js';
import type { Deck } from '../content/deck';
import { makeCardView, CARD_W, CARD_H } from './cardView';
import { CONFIG } from '../engine/config';
import { VW } from './layout';

/** Between-fight reward: pick one reserve card to add to the deck, or heal. */
export function makeRewardScene(
  deck: Deck,
  optionIds: string[],
  onChoose: (choice: string | 'heal') => void,
): Container {
  const c = new Container();

  const title = new Text({
    text: '¡Victoria! Elige tu recompensa',
    style: { fontSize: 34, fill: 0xffffff, fontWeight: 'bold' },
  });
  title.anchor.set(0.5);
  title.x = VW / 2;
  title.y = 220;
  c.addChild(title);

  const totalW = optionIds.length * CARD_W + (optionIds.length - 1) * 28;
  optionIds.forEach((id, i) => {
    const v = makeCardView(deck.byId(id), 0); // new words always start at scene level
    v.x = VW / 2 - totalW / 2 + i * (CARD_W + 28);
    v.y = 360;
    v.eventMode = 'static';
    v.cursor = 'pointer';
    v.on('pointertap', () => onChoose(id));
    c.addChild(v);
    const word = new Text({ text: deck.byId(id).word, style: { fontSize: 20, fill: 0xccc4e0 } });
    word.anchor.set(0.5);
    word.x = v.x + CARD_W / 2;
    word.y = v.y + CARD_H + 24; // reward screen shows the word — a learning moment, not a test
    c.addChild(word);
  });

  const heal = new Container();
  heal.addChild(
    new Graphics().roundRect(0, 0, 300, 64, 12).fill(0x2d5a3a).stroke({ width: 2, color: 0x55aa77 }),
  );
  const healLabel = new Text({
    text: `🩹 Curarse +${CONFIG.rewardHeal}`,
    style: { fontSize: 24, fill: 0xffffff },
  });
  healLabel.anchor.set(0.5);
  healLabel.x = 150;
  healLabel.y = 32;
  heal.addChild(healLabel);
  heal.x = VW / 2 - 150;
  heal.y = 680;
  heal.eventMode = 'static';
  heal.cursor = 'pointer';
  heal.on('pointertap', () => onChoose('heal'));
  c.addChild(heal);

  return c;
}
```

- [ ] **Step 2: Implement src/ui/endScene.ts**

```ts
import { Container, Graphics, Text } from 'pixi.js';
import { VW, VH } from './layout';

export function makeEndScene(victory: boolean, onNewRun: () => void): Container {
  const c = new Container();

  const title = new Text({
    text: victory ? '🏆 ¡Corrida completa!' : '💀 Derrota…',
    style: { fontSize: 52, fill: victory ? 0xffd700 : 0xcc4455, fontWeight: 'bold' },
  });
  title.anchor.set(0.5);
  title.x = VW / 2;
  title.y = VH / 2 - 120;
  c.addChild(title);

  const sub = new Text({
    text: victory ? 'Tus palabras se hacen más fuertes.' : 'Las palabras falladas volverán…',
    style: { fontSize: 24, fill: 0xccc4e0 },
  });
  sub.anchor.set(0.5);
  sub.x = VW / 2;
  sub.y = VH / 2 - 50;
  c.addChild(sub);

  const btn = new Container();
  btn.addChild(
    new Graphics().roundRect(0, 0, 280, 70, 14).fill(0x4a3f6b).stroke({ width: 3, color: 0x9988cc }),
  );
  const label = new Text({ text: 'Nueva corrida', style: { fontSize: 28, fill: 0xffffff } });
  label.anchor.set(0.5);
  label.x = 140;
  label.y = 35;
  btn.addChild(label);
  btn.x = VW / 2 - 140;
  btn.y = VH / 2 + 40;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointertap', onNewRun);
  c.addChild(btn);

  return c;
}
```

- [ ] **Step 3: Replace src/main.ts with the full run orchestration**

```ts
import { Application, Container } from 'pixi.js';
import { createViewport } from './ui/layout';
import { CombatScene } from './ui/combatScene';
import { makeRewardScene } from './ui/rewardScene';
import { makeEndScene } from './ui/endScene';
import { shake, floatNumber } from './ui/juice';
import { sfx, speakSpanish } from './ui/sfx';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';
import { startCombat, type CombatEvent } from './engine/combat';
import { startRun, advanceAfterVictory, rewardOptions, applyReward, markDefeat, type RunState } from './engine/run';
import { CONFIG } from './engine/config';
import { mulberry32, type Rng } from './engine/rng';
import { loadMastery, saveMastery } from './progress/store';
import { levelOf, masteryFor, recordResult, type MasteryMap } from './progress/mastery';

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  const deck = loadDeck(seedJson);
  const mastery: MasteryMap = loadMastery(window.localStorage);
  const rng: Rng = mulberry32(Math.floor(performance.now()));

  let current: Container | null = null;
  const show = (view: Container) => {
    current?.destroy({ children: true }); // CombatScene.view included — same teardown
    current = view;
    root.addChild(view);
  };

  const levelFor = (cardId: string) => levelOf(masteryFor(mastery, cardId));

  function startFight(run: RunState): void {
    const enemy = CONFIG.fights[run.fightIndex];
    const levels = Object.fromEntries(run.deckCardIds.map((id) => [id, levelFor(id)]));
    const flagged = new Set(run.deckCardIds.filter((id) => masteryFor(mastery, id).flagged));
    const { state } = startCombat({
      cardIds: run.deckCardIds,
      levels,
      flagged,
      enemy,
      playerHp: run.playerHp,
      rng,
    });
    const scene = new CombatScene(state, deck, rng, {
      onEvents: handleEvents,
      onCombatEnd: (victory, playerHp) => {
        if (victory) {
          advanceAfterVictory(run, playerHp);
          if (run.phase === 'complete') {
            show(makeEndScene(true, newRun));
          } else {
            show(makeRewardScene(deck, rewardOptions(run, rng), (choice) => {
              applyReward(run, choice);
              startFight(run);
            }));
          }
        } else {
          markDefeat(run);
          show(makeEndScene(false, newRun));
        }
      },
    }, levelFor);
    show(scene.view);

    function handleEvents(events: CombatEvent[]): void {
      for (const e of events) {
        switch (e.type) {
          case 'challengePassed':
            recordResult(mastery, e.cardId, true);
            saveMastery(window.localStorage, mastery);
            sfx.hit();
            speakSpanish(deck.byId(e.cardId).word);
            shake(scene.shakeLayer, 14, 280);
            floatNumber(scene.view, 360, 320, `-${e.damage}`, 0xffdd44);
            break;
          case 'challengeFailed':
            recordResult(mastery, e.cardId, false);
            saveMastery(window.localStorage, mastery);
            sfx.fizzle();
            speakSpanish(e.correctWord);
            floatNumber(scene.view, 360, 320, e.correctWord, 0xff6666);
            break;
          case 'enemyAttack':
            sfx.enemyAttack();
            shake(scene.shakeLayer, 10, 220);
            floatNumber(scene.view, 170, 1000, `-${e.amount}`, 0xff4444);
            break;
          case 'cardsDrawn':
            sfx.draw();
            break;
          case 'victory':
            sfx.victory();
            break;
          case 'defeat':
            sfx.defeat();
            break;
        }
      }
    }
  }

  function newRun(): void {
    const run = startRun(deck, rng);
    startFight(run);
  }

  newRun();
})();
```

- [ ] **Step 4: Manual verification (the complete v0 experience)**

Run: `pnpm dev`. Play full runs, desktop and phone:
1. Fight 1 (👹) → win → reward screen: 3 new word-cards (with words shown — learning
   moment) + heal button. Pick one → fight 2 (🦉, harder) → reward → fight 3 (💀).
2. Win fight 3 → 🏆 completion screen → "Nueva corrida" starts fresh.
3. Die anywhere → 💀 defeat screen → new run.
4. **Mastery persists:** play several runs getting a word right; after 3 cumulative clean
   plays its card shows the single icon (silver border) instead of the scene; after 6,
   the abstract sigil (gold). Reload the page — levels stick (localStorage).
5. **Flagged resurfacing:** deliberately fail a word repeatedly; notice it appears in
   your opening hands noticeably more often in subsequent fights/runs.

- [ ] **Step 5: Run full test suite + typecheck**

Run: `pnpm test && pnpm build`
Expected: tests PASS; `tsc --noEmit` clean; vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ui/rewardScene.ts src/ui/endScene.ts src/main.ts
git commit -m "feat: full v0 run — rewards, end screens, persisted mastery, flagged resurfacing"
```

---

### Task 12: README + playtest checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# traduzco

A game-first Spanish vocabulary roguelike for B2-C1+ learners. Your words, as cards.
Recall is the casting cost.

**Spec:** `docs/superpowers/specs/2026-06-12-traduzco-vocab-roguelike-design.md`
**Plan:** `docs/superpowers/plans/2026-06-12-v0-vocab-roguelike.md`

## Run it

```bash
pnpm install
pnpm dev        # serves on LAN too — open the printed URL on your phone
pnpm test       # engine unit tests (Vitest)
pnpm build      # typecheck + production build
```

## Edit your vocabulary

`src/content/seed-deck.json` — swap in your own notebook words. Each card needs an
`id` (accent-free slug), `word` (with article for nouns), `partOfSpeech`, a `scene`
(2-3 emoji association), an `icon` (1 emoji), and optional `confusableWith` ids for
devious distractors. Stick to visually representable words for now.

## v0 playtest questions (the point of this build)

- Does "one more run" kick in? When did you stop, and why?
- Does seeing a scene → tapping the word feel like *playing* or like *studying*?
- Do the mastery art stages (scene → icon → sigil) feel like leveling up?
- Tuning: too easy/hard? (`src/engine/config.ts` — all numbers in one place)
- Phone: is the tap-target size right? Does a 2-minute bus battle work?
```

- [ ] **Step 2: Verify everything one last time**

Run: `pnpm test && pnpm build`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with run instructions and v0 playtest checklist"
```

---

## Out of scope (per spec — do not build)

Voice modality, vocabulary ingestion, deck editor/sharing, varied enemy mechanics beyond
HP/attack scaling, association minting, backend/accounts, Steam packaging, drag-to-connect
(tap-to-select ships first; drag is a playtest follow-up).
