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
pnpm dev:web     # the landing page
pnpm test        # all workspace test suites
pnpm build       # typecheck + build every app
pnpm build:site  # compose the deployable site/ dir (landing at /, game at /mata-el-torre/)
```

`apps/web` needs `VITE_CLERK_PUBLISHABLE_KEY` (see `apps/web/.env.local`;
CI uses a GitHub Actions repo variable). Missing key = loud build failure
by design.

## Deploy

Push to `main` → GitHub Actions tests, builds, composes `site/`, and deploys
to Cloudflare Pages (project `traduzco`), which sits behind **Cloudflare
Access** — the site is not publicly reachable; visitors get an email
one-time-code prompt against an allowlist.

One-time setup (dashboard, manual):

1. Cloudflare → Workers & Pages → create Pages project `traduzco`
   (direct upload).
2. Zero Trust → Access → Applications: add the Pages project
   (covers `traduzco.pages.dev` + preview URLs) with an email-allowlist
   policy (one-time-PIN login).
3. Create an API token with Cloudflare Pages edit permission; add repo
   secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. GitHub repo settings → Pages: disable the old GitHub Pages site.
5. Later, for traduz.co itself: move DNS to Cloudflare, attach the custom
   domain to the Pages project, and extend the Access app to that hostname.

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
