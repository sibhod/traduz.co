# Formal Deploy Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Branch-based deploys — `development` → gated dev.traduz.co, `production` → public traduz.co with CalVer auto-tags, PRs → gated ephemeral previews with a sticky comment.

**Architecture:** One Cloudflare Pages project (`traduzco`, direct upload from GitHub Actions). Its production branch becomes `production`; every other branch deploy is a Pages *preview* with a stable alias (`<branch>.traduzco.pages.dev`). One workflow file resolves the target (branch + Clerk key) from the trigger. Access model: the Pages Access toggle gates all `*.pages.dev` URLs; dev.traduz.co is a proxied CNAME to the `development` alias intercepted by Eric's existing zone Access app; traduz.co is the single public hostname.

**Tech Stack:** GitHub Actions, cloudflare/wrangler-action v3.15.0 (wrangler 4.107.0), Cloudflare Pages branch deployments, gh CLI, Cloudflare DNS API.

**Spec:** `docs/superpowers/specs/2026-07-04-deploy-workflow-design.md`

## Global Constraints

- Pages project: `traduzco`. Account ID `4c6c23347c3544438481f748081fa0ba`. Zone: `traduz.co`.
- Action pins stay EXACTLY as today: `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1`, `pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0`, `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`, `cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd # v3.15.0`, `wranglerVersion: "4.107.0"`.
- Repo variables (vars context, never secrets): `VITE_CLERK_PUBLISHABLE_KEY_PROD` (pk_live), `VITE_CLERK_PUBLISHABLE_KEY_DEV` (pk_test). The old `VITE_CLERK_PUBLISHABLE_KEY` is deleted only in Task 3 (after the new workflow is on both branches).
- Tags: `vYYYY.MM.DD` (UTC), `-2`/`-3`… suffix when the tag already exists on origin. Lightweight tags.
- Deploy branches: `production` → `--branch=production`; `development` → `--branch=development`; PR #N → `--branch=pr-N` (alias `https://pr-N.traduzco.pages.dev`).
- Never a `_redirects` file. No changes under `apps/`.
- **Ordering gates:** Task 3 (first release) MUST NOT run until Eric confirms the Pages production branch is flipped to `production` — otherwise the production push deploys as a mere preview and traduz.co goes stale silently. Task 2's gating verification depends on Eric enabling the Pages Access toggle.
- Secrets hygiene: never print token or key values; `pk_` publishable values are OK to appear in commands/vars.

---

### Task 1: Environment prep — repo variables + dev DNS

**Files:** none in-repo (GitHub variables + Cloudflare DNS via APIs).

**Interfaces:**
- Consumes: existing repo variable `VITE_CLERK_PUBLISHABLE_KEY` (holds the pk_live value), `apps/web/.env.local` (holds the pk_test value), `.envrc` (CF API token line `export CLOUDFLARE_API_TOKEN=...`).
- Produces: repo variables `VITE_CLERK_PUBLISHABLE_KEY_PROD` and `VITE_CLERK_PUBLISHABLE_KEY_DEV` (Task 2's workflow reads them); proxied CNAME `dev.traduz.co → development.traduzco.pages.dev`.

- [ ] **Step 1: Create the suffixed variables from the existing sources**

```bash
cd /home/eric/projects/traduz.co
PROD_KEY=$(gh variable get VITE_CLERK_PUBLISHABLE_KEY)
DEV_KEY=$(rg -o 'pk_test_[A-Za-z0-9=]+' apps/web/.env.local | head -1)
[ -n "$PROD_KEY" ] && [ -n "$DEV_KEY" ] || { echo "MISSING SOURCE KEY"; exit 1; }
gh variable set VITE_CLERK_PUBLISHABLE_KEY_PROD --body "$PROD_KEY"
gh variable set VITE_CLERK_PUBLISHABLE_KEY_DEV --body "$DEV_KEY"
gh variable list
```

Expected: list shows all three variables; `_PROD` starts `pk_live_`, `_DEV` starts `pk_test_`. Do NOT delete the old variable yet (the workflow on both branches still reads it until Task 3 completes).

- [ ] **Step 2: Create the proxied dev CNAME**

```bash
cd /home/eric/projects/traduz.co
TOKEN=$(sed -n 's/^export CLOUDFLARE_API_TOKEN=//p' .envrc | tr -d '"')
ZONE=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.cloudflare.com/client/v4/zones?name=traduz.co" | jq -r '.result[0].id')
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -d '{"type":"CNAME","name":"dev","content":"development.traduzco.pages.dev","proxied":true,"ttl":1}' \
  | jq -r 'if .success then "OK dev -> \(.result.content) proxied=\(.result.proxied)" else "FAIL: \(.errors|map(.message)|join("; "))" end'
```

Expected: `OK dev -> development.traduzco.pages.dev proxied=true`. PROXIED IS REQUIRED — Access can only intercept traffic that flows through the Cloudflare proxy.

- [ ] **Step 3: Probe current state (baseline, both expected "not yet working")**

```bash
curl -s -o /dev/null -w 'dev.traduz.co: %{http_code}\n' --max-time 15 https://dev.traduz.co/
```

Expected: NOT 200-with-content — either a 3xx to `sibhod.cloudflareaccess.com` (Eric's Access app already active) or a Cloudflare 5xx (522/530: no `development` branch deployment exists yet — Task 2 creates the first one). Record which. A 200 serving the site would mean the Access app is NOT covering dev.traduz.co — flag that to the controller instead of proceeding silently.

- [ ] **Step 4: Report** — no commit (nothing in-repo changed). Report the three variable names, the DNS record result, and the Step 3 status code.

---

### Task 2: The new deploy workflow + README

**Files:**
- Rewrite: `.github/workflows/deploy.yml` (full content below)
- Modify: `README.md` (Deploy section)

**Interfaces:**
- Consumes: repo variables from Task 1; existing root scripts `test`/`build:site`; secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (unchanged).
- Produces: on `development` push — a Pages deployment at alias `development.traduzco.pages.dev` (dev.traduz.co fronts it); the workflow file that Task 3's production push and Task 4's PR rely on.

- [ ] **Step 1: Rewrite `.github/workflows/deploy.yml`** (full new content)

```yaml
name: Deploy

on:
  push:
    branches: [development, production]
  pull_request:
  workflow_dispatch:

permissions:
  contents: write        # production auto-tag push
  pull-requests: write   # sticky preview comment

concurrency:
  group: deploy-${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || github.ref_name }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test # red suite never ships

      - name: Resolve deploy target
        id: target
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            echo "branch=pr-${{ github.event.number }}" >> "$GITHUB_OUTPUT"
            echo "env=dev" >> "$GITHUB_OUTPUT"
          elif [ "${{ github.ref_name }}" = "production" ]; then
            echo "branch=production" >> "$GITHUB_OUTPUT"
            echo "env=prod" >> "$GITHUB_OUTPUT"
          else
            echo "branch=development" >> "$GITHUB_OUTPUT"
            echo "env=dev" >> "$GITHUB_OUTPUT"
          fi

      - run: pnpm build:site
        env:
          # prod deploys use the production Clerk instance (bound to traduz.co);
          # everything else uses the dev instance (pk_test works from any origin).
          VITE_CLERK_PUBLISHABLE_KEY: ${{ steps.target.outputs.env == 'prod' && vars.VITE_CLERK_PUBLISHABLE_KEY_PROD || vars.VITE_CLERK_PUBLISHABLE_KEY_DEV }}

      - uses: cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd # v3.15.0
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          # Must match the root devDependency — a mismatch makes the action
          # try to self-install, which fails in a pnpm workspace.
          wranglerVersion: "4.107.0"
          command: pages deploy site --project-name=traduzco --branch=${{ steps.target.outputs.branch }}

      - name: Tag release (CalVer)
        if: github.event_name == 'push' && github.ref_name == 'production'
        run: |
          base="v$(date -u +%Y.%m.%d)"
          tag="$base"; n=1
          while [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; do
            n=$((n+1)); tag="$base-$n"
          done
          git tag "$tag"
          git push origin "$tag"
          echo "Tagged $tag" >> "$GITHUB_STEP_SUMMARY"

      - name: PR preview comment (sticky)
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          url="https://${{ steps.target.outputs.branch }}.traduzco.pages.dev"
          body="🎴 Preview deployed: ${url} (Cloudflare Access gated)
          Updated for $(git rev-parse --short HEAD)."
          gh pr comment "${{ github.event.number }}" --edit-last --body "$body" \
            || gh pr comment "${{ github.event.number }}" --body "$body"
```

Notes baked into the design (do not "fix" these):
- The preview URL is the deterministic branch alias (`pr-N.traduzco.pages.dev`), not the per-deploy hash URL — stable across pushes, so the sticky comment stays truthful.
- Lightweight tags need no git identity config; `git ls-remote` checks origin so no `fetch-tags`/`fetch-depth` needed.
- Fork PRs would lack the Cloudflare secrets — irrelevant for this private solo repo.

- [ ] **Step 2: README Deploy section** — in `README.md`, replace the entire `## Deploy` section body (from the `## Deploy` heading down to, but not including, `## Mata el Torre`) with:

```markdown
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
```

- [ ] **Step 3: Commit and push to development**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: branch-based deploys — dev.traduz.co, prod CalVer tags, PR previews"
git push origin development
```

- [ ] **Step 4: Watch the run and verify the development deployment**

```bash
RUN=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
until [ "$(gh run view "$RUN" --json status --jq .status)" = "completed" ]; do sleep 8; done
gh run view "$RUN" --json conclusion --jq .conclusion   # expect: success
curl -s -o /dev/null -w 'branch alias: %{http_code}\n' https://development.traduzco.pages.dev/
curl -s -o /dev/null -w 'dev.traduz.co: %{http_code}\n' https://dev.traduz.co/
curl -s -o /dev/null -w 'traduz.co:    %{http_code}\n' https://traduz.co/
```

Expected: run success. `traduz.co: 200` (unchanged, still serving the last interim deploy — development pushes no longer touch it). The two dev URLs: 302 (to `sibhod.cloudflareaccess.com`) once Eric's Pages Access toggle + dev Access app are on; if either shows 200-with-site, report it — the controller gates on Eric's dashboard steps. Record actual codes in the report.

---

### Task 3: First production release (CONTROLLER GATE: Eric must confirm the Pages production branch = `production` first)

**Files:** none (git + dashboard-dependent verification).

**Interfaces:**
- Consumes: Task 2's workflow on `development`; Eric's dashboard flip of the Pages production branch.
- Produces: traduz.co serving a production-keyed build deployed from the `production` branch; first CalVer tag on origin; old Clerk variable deleted.

- [ ] **Step 1: Merge development into production and push**

```bash
git switch production && git pull origin production
git merge --no-ff development -m "release: first branch-based production deploy"
git push origin production
git switch development
```

- [ ] **Step 2: Watch the production run**

```bash
RUN=$(gh run list --branch production --limit 1 --json databaseId --jq '.[0].databaseId')
until [ "$(gh run view "$RUN" --json status --jq .status)" = "completed" ]; do sleep 8; done
gh run view "$RUN" --json conclusion --jq .conclusion   # expect: success
```

- [ ] **Step 3: Verify the release end-to-end**

```bash
curl -s -o /dev/null -w 'traduz.co: %{http_code}\n' https://traduz.co/        # 200, public, NO Access redirect
git ls-remote --tags origin | rg 'v2026\.'                                     # the new CalVer tag
curl -s https://traduz.co/ | rg -c 'traduzco'                                  # >= 1
```

Also confirm traduz.co got the PRODUCTION Clerk key: fetch the referenced JS asset from the live page and check it contains `pk_live` and NOT `pk_test`:

```bash
ASSET=$(curl -s https://traduz.co/ | rg -o '/assets/[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://traduz.co$ASSET" | rg -o 'pk_(live|test)_[A-Za-z0-9]+' | sort -u
```

Expected: exactly one match, starting `pk_live_`.

- [ ] **Step 4: Retire the old variable**

```bash
gh variable delete VITE_CLERK_PUBLISHABLE_KEY
gh variable list   # expect only the _PROD and _DEV pair
```

---

### Task 4: PR ephemeral preview validation

**Files:** a throwaway branch with a trivial change (e.g., one clarifying word in README), reverted by closing the PR unmerged.

**Interfaces:**
- Consumes: Task 2's workflow (pull_request path).
- Produces: proof the PR flow works; no lasting repo changes.

- [ ] **Step 1: Open a test PR**

```bash
git switch -c test/pr-preview development
printf '\n<!-- pr-preview smoke test -->\n' >> README.md
git add README.md && git commit -m "test: pr preview smoke"
git push -u origin test/pr-preview
gh pr create --base development --title "test: PR preview smoke" --body "Throwaway — validates the ephemeral preview flow. Close unmerged."
```

- [ ] **Step 2: Watch the PR run and verify**

```bash
PR=$(gh pr view test/pr-preview --json number --jq .number)
RUN=$(gh run list --event pull_request --limit 1 --json databaseId --jq '.[0].databaseId')
until [ "$(gh run view "$RUN" --json status --jq .status)" = "completed" ]; do sleep 8; done
gh run view "$RUN" --json conclusion --jq .conclusion            # success
gh pr view "$PR" --json comments --jq '.comments[-1].body'       # contains pr-N.traduzco.pages.dev
curl -s -o /dev/null -w 'preview: %{http_code}\n' "https://pr-$PR.traduzco.pages.dev/"   # 302 to Access (gated)
```

- [ ] **Step 3: Push a second commit, confirm the comment UPDATES (sticky, not duplicate)**

```bash
printf '<!-- second push -->\n' >> README.md
git add README.md && git commit -m "test: second push" && git push
# wait for that run to complete (same loop as Step 2), then:
gh pr view "$PR" --json comments --jq '[.comments[] | select(.body | contains("Preview deployed"))] | length'   # expect 1
```

- [ ] **Step 4: Clean up**

```bash
gh pr close "$PR" --delete-branch
git switch development && git branch -D test/pr-preview 2>/dev/null || true
```

- [ ] **Step 5: Final sweep** — confirm the world is in its end state:

```bash
curl -s -o /dev/null -w 'traduz.co (public):        %{http_code}\n' https://traduz.co/
curl -s -o /dev/null -w 'traduzco.pages.dev (gated): %{http_code}\n' https://traduzco.pages.dev/
curl -s -o /dev/null -w 'dev.traduz.co (gated):      %{http_code}\n' https://dev.traduz.co/
```

Expected: 200 / 302 / 302.
