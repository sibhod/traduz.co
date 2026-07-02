# Monorepo Restructure + Landing Page — Design

**Date:** 2026-07-02
**Status:** Approved 2026-07-02 (incl. hosting/access revision)

## Goal

Turn the traduz.co repo into a pnpm-workspace monorepo. The existing
mata-el-torre game becomes one app among potentially many; a minimal landing
page becomes the site root at traduz.co. Future apps, games, demos, and POCs
each get their own workspace under `apps/` (shared code, when it emerges, under
`packages/`).

## Decisions

All confirmed with Eric:

1. **Scope (confirmed):** restructure + add a minimal landing page now. No
   shared-package extraction yet — the engine/progress/content code stays
   inside the game until a second consumer actually exists.
2. **URL layout (confirmed):** path-based. Landing at `traduz.co/`, game at
   `traduz.co/mata-el-torre/`. One composed static site serves both builds.
   Alternatives considered: subdomain-per-app (needs DNS per app and separate
   projects). The game already builds with `base: './'`, so it runs unchanged
   from a subpath.
2a. **Hosting + access control (confirmed):** move from GitHub Pages to
   **Cloudflare Pages with Cloudflare Access in front**. Eric does not want
   the site publicly reachable yet; GitHub Pages has no access control at
   all, so it is out. Cloudflare Access (free tier) gates the whole site at
   the edge with an email one-time-code prompt against an allowlist — zero
   app code. Clerk (or similar) arrives later as the *in-app* account system
   when real user features exist; edge gating is the interim privacy layer,
   and the two can coexist afterwards. Alternatives considered: Vercel
   deployment protection (team-members-only on free tier; password
   protection is paid) and client-side Clerk on static hosting (gates the UI
   only — bundles stay fetchable — so it fails the actual requirement).
3. **Tooling (confirmed):** plain pnpm workspaces — no Turborepo or Nx.
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

The GitHub Pages workflow is replaced by a Cloudflare Pages deploy, still run
from GitHub Actions on push to main (keeps CI test-gating in one place rather
than using Cloudflare's git integration, which can't compose two builds):

```
pnpm install --frozen-lockfile
pnpm -r test                      # red suite never ships
pnpm -r build
mkdir -p site
cp -r apps/web/dist/*  site/
mkdir -p site/mata-el-torre
cp -r apps/mata-el-torre/dist/* site/mata-el-torre/
npx wrangler pages deploy site --project-name traduzco
```

Requires two repo secrets: `CLOUDFLARE_API_TOKEN` (Pages edit permission) and
`CLOUDFLARE_ACCOUNT_ID`.

**One-time dashboard setup (Eric, manual):**

1. Create the Cloudflare Pages project `traduzco` (direct-upload mode).
2. In Zero Trust → Access, enable the Access policy on the Pages project
   (protects `traduzco.pages.dev` *and* preview URLs) with an email allowlist
   (Eric + testers). Login = email one-time code, no passwords to manage.
3. Create the API token, add both secrets to the GitHub repo.
4. Disable the old GitHub Pages site in repo settings so the public copy
   stops being served.
5. Later, when pointing the real domain: move traduz.co DNS to Cloudflare and
   attach it as a custom domain (Access policy must then also cover that
   hostname).

The site initially lives at `traduzco.pages.dev` behind Access; the old
public Pages URL goes dark. Existing playtest links break — acceptable (v0
links only). Note localStorage is keyed per-origin, so persisted mastery from
the old origin does **not** carry over to the new one; also acceptable at v0.

## Data flow / error handling

No runtime behavior changes. The only new failure surface is the deploy
composition step; `cp` failures fail the job visibly. `pnpm -r test` still
gates deploys.

## Testing / verification

1. `pnpm install` from clean root resolves the workspace.
2. `pnpm -r test` — game suite passes unchanged.
3. `pnpm -r build` — both apps emit `dist/`.
4. Serve a locally composed `site/` dir and manually verify: landing loads at
   `/`, game loads and plays at `/mata-el-torre/`.
5. Post-merge: on `traduzco.pages.dev`, verify an incognito visit hits the
   Access email-code prompt (site is NOT publicly reachable), and that an
   allowlisted login reaches both the landing page and the game.

## Out of scope

- Shared `packages/*` extraction (engine, mastery, content types) — wait for a
  second consumer.
- Real landing-page design.
- In-app user accounts (Clerk or similar) — that's the future account system;
  Cloudflare Access is the interim privacy gate and coexists with it later.
- Custom-domain DNS cutover to traduz.co (Cloudflare dashboard/DNS task, not
  a code task; the relative-base builds are already compatible).
- Turborepo/Nx, changesets, versioning — all YAGNI at two private apps.
