# traduzco

Monorepo for traduz.co — games, demos, and POCs for game-first Spanish
learning (B2–C1+).

| App | Path | What |
| --- | --- | --- |
| `apps/web` | `/` | traduz.co app: attract page + Clerk auth + `/home` (TanStack Start SPA) |
| `apps/mata-el-torre` | `/mata-el-torre/` | Vocabulary roguelike. Your words as cards; recall is the casting cost. |

Shared code will live in `packages/*` when something earns extraction.

## Run

```bash
pnpm install
pnpm dev:torre   # the game (serves on LAN — open the printed URL on your phone)
pnpm dev:web     # the traduz.co app (attract page + Clerk auth + /home)
pnpm test        # all workspace test suites
pnpm build       # typecheck + build every app
pnpm build:site  # compose the deployable site/ dir (web app at /, game at /mata-el-torre/)
```

`apps/web` needs `VITE_CLERK_PUBLISHABLE_KEY` (see `apps/web/.env.local`;
CI uses a GitHub Actions repo variable). Missing key = loud build failure
by design.

## Deploy

Branch-based via Cloudflare Pages (project `traduzco`), all from GitHub
Actions:

| Push to | Deploys to | Clerk instance | Visibility |
| --- | --- | --- | --- |
| `development` | dev.traduz.co | dev (`pk_test`) | Cloudflare Access gated |
| `production` | traduz.co (+ CalVer tag `vYYYY.MM.DD`) | prod (`pk_live`) | public |
| any PR | `pr-<n>.traduzco.pages.dev` (sticky PR comment) | dev | Access gated |

Release = merge `development` → `production` and push; the workflow deploys
and tags. All `*.traduzco.pages.dev` URLs sit behind the Pages Access
policy; traduz.co is the only public hostname. Never add a catch-all
`_redirects` — it would swallow `/mata-el-torre/`.

## Mata el Torre

**Spec:** `docs/superpowers/specs/2026-06-12-traduzco-vocab-roguelike-design.md`
**Plan:** `docs/superpowers/plans/2026-06-12-v0-vocab-roguelike.md`

### Edit your vocabulary

`apps/mata-el-torre/src/content/seed-deck.json` — swap in your own notebook
words. Each card needs an `id` (accent-free slug), `word` (with article for
nouns), `partOfSpeech` (verb | noun | adj | phrase), a `scene` (2-3 emoji
association), an `icon` (1 emoji), and optional `confusableWith` ids for
devious distractors. Words and ids must be unique; the loader validates on
boot and tells you exactly what's wrong. Stick to visually representable
words for now.

### Tuning

All gameplay numbers (HP, damage, energy, enemies, mastery thresholds' damage
scaling) live in `apps/mata-el-torre/src/engine/config.ts`. Mastery level
thresholds are in `apps/mata-el-torre/src/progress/mastery.ts`
(`LEVEL_THRESHOLDS`). A dev handle `window.__traduzco` exposes live
`{ run, combat }` state in the console for poking around.

### v0 playtest questions (the point of this build)

- Does "one more run" kick in? When did you stop, and why?
- Does seeing a scene → tapping the word feel like *playing* or like *studying*?
- Do the mastery art stages (scene → icon → sigil) feel like leveling up?
- Tuning: too easy/hard? (`apps/mata-el-torre/src/engine/config.ts` — all numbers in one place)
- Phone: is the tap-target size right? Does a 2-minute bus battle work?

## Repo layout

Monorepo spec: `docs/superpowers/specs/2026-07-02-monorepo-restructure-design.md`

<!-- pr-preview smoke test -->
<!-- second push -->
