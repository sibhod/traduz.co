# Monorepo Restructure + Landing Page — Design

**Date:** 2026-07-02
**Status:** Awaiting review

## Goal

Turn the traduz.co repo into a pnpm-workspace monorepo. The existing
mata-el-torre game becomes one app among potentially many; a minimal landing
page becomes the site root at traduz.co. Future apps, games, demos, and POCs
each get their own workspace under `apps/` (shared code, when it emerges, under
`packages/`).

## Decisions

Two decisions were confirmed with Eric; one was made by best judgment while he
was away and is flagged for veto:

1. **Scope (confirmed):** restructure + add a minimal landing page now. No
   shared-package extraction yet — the engine/progress/content code stays
   inside the game until a second consumer actually exists.
2. **URL layout (best judgment — veto if wrong):** path-based on the existing
   GitHub Pages deploy. Landing at `traduz.co/`, game at
   `traduz.co/mata-el-torre/`. One Pages artifact composes both builds.
   Alternatives considered: subdomain-per-app (needs DNS + separate
   repos/hosts) and moving to Vercel/Netlify/Cloudflare (native monorepo
   support, but a hosting migration is out of scope for this refactor). The
   game already builds with `base: './'`, so it runs unchanged from a subpath.
3. **Tooling (best judgment):** plain pnpm workspaces — no Turborepo or Nx.
   With two small apps there is no task graph worth caching, and root
   `pnpm -r` scripts cover fan-out. Revisit only if build times or
   cross-package dependencies make it worthwhile.

## Target structure

```
traduz.co/
├── package.json               # root: private, workspace-wide scripts only
├── pnpm-workspace.yaml        # packages: apps/*, packages/*
├── pnpm-lock.yaml             # single lockfile at root
├── tsconfig.base.json         # shared strict compiler options
├── apps/
│   ├── web/                   # landing page → traduz.co/
│   │   ├── package.json       # @traduzco/web
│   │   ├── index.html
│   │   ├── vite.config.ts     # base './'
│   │   ├── tsconfig.json      # extends ../../tsconfig.base.json
│   │   └── src/
│   └── mata-el-torre/         # the game → traduz.co/mata-el-torre/
│       ├── package.json       # @traduzco/mata-el-torre
│       ├── index.html         # moved from root (git mv, history preserved)
│       ├── vite.config.ts
│       ├── tsconfig.json      # extends ../../tsconfig.base.json
│       └── src/               # moved wholesale, no internal changes
├── docs/                      # stays at root (repo-wide specs/plans)
├── README.md                  # updated for monorepo layout
└── .github/workflows/deploy.yml
```

`packages/` is declared in `pnpm-workspace.yaml` but the directory is not
created until the first shared package exists.

## Components

### Root workspace

- `package.json`: name `traduzco`, private, `packageManager: pnpm`, engines
  pinned as today. Scripts: `test` → `pnpm -r test`, `build` → `pnpm -r build`,
  plus conveniences `dev:web` and `dev:torre` (`pnpm --filter ... dev`).
  No dependencies at root; each app owns its own deps (vite, vitest,
  typescript stay per-app so apps can diverge later).
- `tsconfig.base.json`: the current strict compiler options minus `include`;
  each app's `tsconfig.json` extends it and adds `"include": ["src"]`.

### apps/mata-el-torre (move, not rewrite)

Everything game-related moves via `git mv`: `src/`, `index.html`,
`vite.config.ts`, `tsconfig.json`. Its `package.json` is new
(`@traduzco/mata-el-torre`), carrying the current scripts and deps
(pixi.js, vite, vitest, typescript). Zero source-code changes — the relative
`base: './'` already makes the build subpath-safe.

### apps/web (new, deliberately minimal)

A static Vite + TypeScript page, no framework: title, one-line tagline, and a
card/link to Mata el Torre (room to list future apps). Same stack idioms as
the game. A `test` script with `--passWithNoTests` keeps `pnpm -r test` green.
Visual design is intentionally throwaway-simple in this refactor; a real
landing design is its own future project.

### Deploy workflow

Same trigger (push to main) and Pages actions; the build job becomes:

```
pnpm install --frozen-lockfile
pnpm -r test
pnpm -r build
mkdir -p site
cp -r apps/web/dist/*  site/
mkdir -p site/mata-el-torre
cp -r apps/mata-el-torre/dist/* site/mata-el-torre/
# upload-pages-artifact with path: site
```

The old game URL (`…/traduz.co/` root) becomes the landing page; the game
moves to `…/mata-el-torre/`. Acceptable breakage at this stage (v0 playtest
links only). LocalStorage progress is keyed per-origin, not per-path, so
persisted mastery survives the move on the same origin.

## Data flow / error handling

No runtime behavior changes. The only new failure surface is the deploy
composition step; `cp` failures fail the job visibly. `pnpm -r test` still
gates deploys.

## Testing / verification

1. `pnpm install` from clean root resolves the workspace.
2. `pnpm -r test` — game suite passes unchanged.
3. `pnpm -r build` — both apps emit `dist/`.
4. Serve a locally composed `site/` dir and manually verify: landing loads at
   `/`, game loads and plays at `/mata-el-torre/`, persisted mastery from a
   pre-refactor session is still readable.
5. Post-merge: check the live Pages deploy for both paths.

## Out of scope

- Shared `packages/*` extraction (engine, mastery, content types) — wait for a
  second consumer.
- Real landing-page design.
- Custom-domain DNS cutover to traduz.co (repo settings/DNS task, not a code
  task; the relative-base builds are already compatible).
- Turborepo/Nx, changesets, versioning — all YAGNI at two private apps.
