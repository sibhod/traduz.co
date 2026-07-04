# Formal Deploy Workflow — Design

**Date:** 2026-07-04
**Status:** Approved 2026-07-04

## Goal

Replace the interim "development deploys to traduz.co" hack with the real
model: `development` auto-deploys to a gated **dev.traduz.co**, `production`
deploys to the public **traduz.co** as tagged releases, and every PR gets an
ephemeral, Access-gated preview URL.

## Decisions (all confirmed with Eric)

1. **One Pages project, branch-based.** The `traduzco` Pages project's
   production branch flips `main` → `production`. Every non-production branch
   push is a preview deployment with a stable alias
   (`<branch>.traduzco.pages.dev`). Alternative rejected: two Pages projects
   (harder separation, more dashboard objects, PR previews need a third
   story).
2. **Releases = push to `production` + auto-tag.** Merging
   `development` → `production` deploys traduz.co; the workflow then tags the
   commit CalVer-style (`vYYYY.MM.DD`, `-N` suffix on same-day repeats) and
   pushes the tag. Git is the release mechanism; tags are the record.
3. **PR ephemeral previews included now.** `pull_request` runs deploy
   `--branch=pr-<number>` and posts/updates a sticky PR comment with the
   preview URL.

## Access / visibility model

Exactly one public hostname: **traduz.co**.

- **Pages Access toggle re-enabled (Eric, dashboard):** gates ALL
  `*.traduzco.pages.dev` URLs — the production alias, the `development`
  alias, and every PR preview. (Currently OFF: `traduzco.pages.dev` serves
  200 publicly — that leak is what this closes.)
- **dev.traduz.co:** proxied (orange-cloud) CNAME → `development.traduzco.pages.dev`
  — proxied is REQUIRED so Eric's existing Cloudflare Access application on
  dev.traduz.co can intercept requests. Created via the CF API with the
  repo-scoped DNS token.
- **traduz.co:** unchanged, public, custom domain on the production branch.
- Note the asymmetry is deliberate: custom domains are NOT covered by the
  Pages Access toggle (that covers only pages.dev hostnames), which is
  exactly why traduz.co stays public while dev.traduz.co needs its own
  zone-level Access app (already created by Eric).

## Clerk environment mapping

Two GitHub Actions **repository variables** (publishable keys, public by
design; set via `gh variable set`):

| Variable | Key | Used by |
| --- | --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY_PROD` | `pk_live_…` (production instance, bound to traduz.co) | `production` deploys |
| `VITE_CLERK_PUBLISHABLE_KEY_DEV` | `pk_test_…` (development instance) | `development` deploys + PR previews |

The old unsuffixed `VITE_CLERK_PUBLISHABLE_KEY` variable is deleted after the
workflow switches to the suffixed pair. Note dev.traduz.co runs the Clerk
dev instance (pk_test works from any origin), so auth works there without
touching the Clerk prod instance's domain config.

## Workflow design (`.github/workflows/deploy.yml`, single file)

Triggers: `push: [development, production]`, `pull_request`, and
`workflow_dispatch` (manual re-run).

Shared steps (all triggers): checkout (full depth on production — tagging
needs it), pnpm setup, frozen install, `pnpm test` (red suite never ships),
`pnpm build:site` with the env-appropriate Clerk variable.

Per-trigger deploy step (wrangler-action, same pins as today):

- `production` push → `pages deploy site --project-name=traduzco --branch=production`,
  then auto-tag: compute `vYYYY.MM.DD` from UTC date, append `-2`, `-3`… if
  the tag exists, `git tag` + `git push origin <tag>` using the workflow's
  `GITHUB_TOKEN` (permissions: `contents: write`).
- `development` push → `--branch=development`.
- `pull_request` → `--branch=pr-${{ github.event.number }}`, then a sticky
  comment on the PR with the deployment URL (workflow permission
  `pull-requests: write`; update-in-place, not one comment per push).

Concurrency: `group: deploy-${{ github.ref }}` (PRs:
`deploy-pr-${{ github.event.number }}`), `cancel-in-progress: true` — one
environment's deploy never cancels another's.

The interim `--branch=main` step and its comment are deleted.

## One-time setup

Eric (dashboard, ~2 minutes):
1. Pages project `traduzco` → Settings → change production branch to
   `production`.
2. Pages project → Settings → enable the Access policy toggle (gates all
   pages.dev URLs).

Automated during implementation:
- Proxied CNAME `dev.traduz.co` → `development.traduzco.pages.dev` (CF API,
  existing DNS-scoped token).
- `gh variable set` for the two suffixed Clerk variables; delete the old one
  after the workflow lands.

## First release + verification

1. Merge the workflow into `development`; its push deploys the `development`
   branch → verify dev.traduz.co serves behind the Access prompt and auth
   works there (pk_test).
2. Verify `traduzco.pages.dev` and `development.traduzco.pages.dev` now hit
   the Access prompt (toggle works).
3. Merge `development` → `production`, push → traduz.co updates (public,
   pk_live), tag `v2026.07.XX` appears on origin.
4. Open a trivial test PR → preview deploys, sticky comment appears with a
   gated URL; close the PR.
5. Confirm traduz.co remains publicly reachable (200, no Access).

## Out of scope (recorded future projects)

- **Content gating of games/apps** (e.g., Mata el Torre behind auth). Eric's
  instinct: a CF Worker enforcement point is the wrong shape. This brainstorm
  belongs with the broader platform design (likely: apps served through the
  authed app shell or per-app auth), not with deploy plumbing.
- **Apps as separate repos/projects** that build and publish independently of
  the monorepo. Nothing in this design blocks it: the composed static site
  can later become per-app Pages projects or a build fan-in. Deliberately
  deferred.
- Staging branch/environment — the topology supports it for free later
  (`staging` branch + CNAME), not created now.
- GitHub branch protection rules for `production` — Eric's call, dashboard
  territory, orthogonal.
