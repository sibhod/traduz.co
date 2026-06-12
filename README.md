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
`id` (accent-free slug), `word` (with article for nouns), `partOfSpeech`
(verb | noun | adj | phrase), a `scene` (2-3 emoji association), an `icon` (1 emoji),
and optional `confusableWith` ids for devious distractors. Words and ids must be unique;
the loader validates on boot and tells you exactly what's wrong. Stick to visually
representable words for now.

## Tuning

All gameplay numbers (HP, damage, energy, enemies, mastery thresholds' damage scaling)
live in `src/engine/config.ts`. Mastery level thresholds are in `src/progress/mastery.ts`
(`LEVEL_THRESHOLDS`). A dev handle `window.__traduzco` exposes live `{ run, combat }`
state in the console for poking around.

## v0 playtest questions (the point of this build)

- Does "one more run" kick in? When did you stop, and why?
- Does seeing a scene → tapping the word feel like *playing* or like *studying*?
- Do the mastery art stages (scene → icon → sigil) feel like leveling up?
- Tuning: too easy/hard? (`src/engine/config.ts` — all numbers in one place)
- Phone: is the tap-target size right? Does a 2-minute bus battle work?
