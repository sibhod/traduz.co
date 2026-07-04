# traduz.co Web App Scaffold (Clerk auth) — Design

**Date:** 2026-07-03
**Status:** Awaiting review

## Goal

Turn `apps/web` from a static placeholder into the scaffold of the real
traduz.co app: a marketing/attract page at `/` with sign-up/sign-in (Clerk),
and an authenticated `/home` page users land on after auth. Scaffolding only —
real marketing design and real /home features come later.

## Decisions

Revised 2026-07-03 after Eric's review:

1. **TanStack Start (Eric's call, revising the earlier React-SPA pick).**
   `apps/web` becomes a TanStack Start app (React 19, file-based TanStack
   Router routes, Vite plugin) with `@clerk/tanstack-react-start`. Eric wants
   the future-proofing: routing, loaders, and a path to server functions
   without a later framework migration. **Sub-decision (best judgment — veto
   if wrong): the app runs in SPA/static mode**, emitting a static `dist/`
   like any Vite build, because our deploy is static composition onto
   Cloudflare Pages (landing + game in one artifact). Full SSR/server
   functions would force a move to Cloudflare Workers — real work, zero
   scaffold benefit today, and TanStack Start makes turning SSR on later a
   config change rather than a rewrite. The `clerk-tanstack-patterns` and
   `clerk-setup` agent skills (installed in-repo) are the reference for
   integration specifics during planning/implementation. **Clerk package
   note (from that skill):** `@clerk/tanstack-react-start`'s value is
   server-side (`clerkMiddleware`, `auth()`) and inert in SPA/static mode,
   so the scaffold uses `@clerk/react` directly (client-side provider
   + components); swap to the Start package when SSR turns on. The game app
   is untouched Pixi.
2. **Modal auth, no auth routes (best judgment).** Landing page has
   Sign up / Sign in buttons using Clerk's modal mode — no `/sign-in`
   routes to build or style. `signInFallbackRedirectUrl` /
   `signUpFallbackRedirectUrl` send users to `/home` after auth.
3. **/home is the app index (best judgment).** The `APPS` registry (and the
   Mata el Torre card) moves from the landing page to `/home`. The landing
   page becomes pure attract: name, one-liner, auth buttons. Note the game
   itself stays directly reachable at `/mata-el-torre/` — it is a static
   sibling app; Clerk gates the `/home` UI, not the game assets. Real
   content gating needs a backend and is explicitly out of scope.
4. **Clerk development instance for now (best judgment).** Scaffold runs on
   Clerk dev-instance keys. A production Clerk instance needs DNS records on
   traduz.co and matters only when the site goes public — deferred. The
   publishable key is public-by-design; it ships in the client bundle.

## Architecture

`apps/web` (all new/rewritten, same package):

```
apps/web/
├── package.json            # + react, react-dom, @tanstack/react-router, @tanstack/react-start, @clerk/tanstack-react-start
├── vite.config.ts          # tanstackStart() plugin, SPA/static output mode
├── tsconfig.json           # + "jsx": "react-jsx" (plus whatever the Start plugin requires — see clerk-tanstack-patterns skill)
└── src/
    ├── router.tsx / entry files   # per current TanStack Start scaffold conventions
    ├── routes/
    │   ├── __root.tsx      # ClerkProvider (key from env, fail fast) + outlet + shared shell
    │   ├── index.tsx       # Landing: attract placeholder — h1, tagline, SignUp/SignIn modal buttons; SignedIn users see "Go to home"
    │   └── home.tsx        # auth-guarded (SignedIn/SignedOut redirect pattern): UserButton + APPS registry cards
    ├── apps.ts             # registry paths become ABSOLUTE ('/mata-el-torre/') — relative paths mis-resolve from /home-style URLs now that routes exist
    └── apps.test.ts        # updated to assert absolute-with-trailing-slash paths
```

Exact entry-file names/config follow the current TanStack Start scaffold
(the plan pins them; `clerk-tanstack-patterns` skill is the authority for
the Clerk wiring). The guard uses Clerk's client components in SPA mode —
`beforeLoad`-based server guards arrive with SSR later.

- **Env:** `VITE_CLERK_PUBLISHABLE_KEY` read via `import.meta.env`;
  `main.tsx` throws a clear error at boot if missing. Locally:
  `apps/web/.env.local` (gitignored — already covered by `.env.*`). CI: a
  GitHub Actions **repository variable** (`vars.VITE_CLERK_PUBLISHABLE_KEY`,
  not a secret — the key is public by design) exported in the build step.
- **Routing on static hosting:** TanStack Router history routing (clean
  URLs). Deep links like `/home` work via Cloudflare Pages' built-in SPA
  fallback (unmatched paths serve the root `index.html`). **Constraint:
  never add a catch-all `_redirects` rule** — Pages redirects outrank static
  assets and a `/*` rule would swallow `/mata-el-torre/`.
- **Base path:** `apps/web` builds at `base: '/'` (it is always served at
  the domain root; a relative base would mis-resolve assets on `/home` deep
  links). The game keeps `base: './'` since it lives at a subpath.

## Branches & deploy (interim)

The repo's default branch is now `development`; `production` exists for
tested, versioned releases. The full model — `development` auto-deploys to
dev.traduz.co, `production` deploys to traduz.co — is the **next project**
(formal deploy workflow), not this one. Interim state so deploys don't stop:
`deploy.yml` triggers on `development` and passes `--branch=main` to wrangler
so pushes keep updating the Pages project's production branch (= traduz.co +
pages.dev). Once dev.traduz.co exists, primary work targets it and
`production` owns traduz.co.

Clerk environments map onto this: the **development instance** (pk_test)
serves local dev and, later, dev.traduz.co; the **production instance** is
bound to traduz.co (Clerk free plan: one production domain). Production-
instance DNS records go into Cloudflare as part of this project's setup
(fetched via the repo-scoped Clerk CLI; records must be DNS-only/unproxied —
Clerk issues its own certificates).

## Auth flow

Visitor at `/` → Sign up / Sign in (Clerk modal) → Clerk redirects to `/home`
→ `RequireAuth` renders Home for signed-in users. Signed-out visitor
deep-linking `/home` → `<RedirectToSignIn>` (returns to `/home` after).
Sign-out via `UserButton` → Clerk's `afterSignOutUrl="/"`.

Cloudflare Access remains the outer gate for everything, unchanged — Clerk
operates inside it. (Two logins during this phase is accepted and correct:
Access = "is this a tester", Clerk = "which user".)

## Error handling

- Missing publishable key: explicit `throw` at boot with the variable name.
- Clerk script/network failure inside Access: Clerk's own components surface
  errors; nothing custom at scaffold stage.

## Testing

- `apps.test.ts` updated for absolute paths.
- Route-guard and Landing/Home rendering: component tests with
  `@testing-library/react` + jsdom, mocking `@clerk/tanstack-react-start`
  exports (SignedIn/SignedOut render/hide children based on a mocked auth
  state) — tests real routing/guard wiring without Clerk network calls.
- Manual verification: full modal sign-up → `/home` flow on a Clerk dev
  instance, locally and on the deployed site.

## One-time setup

Done by Eric (2026-07-03): Clerk app created; `VITE_CLERK_PUBLISHABLE_KEY`
in `apps/web/.env.local` and in GitHub Actions repo variables; branches
renamed (`development` default, `production` added).

Remaining:

1. **Repo-scoped Clerk CLI (no global auth):** `.envrc` (direnv, gitignored)
   sets `CLERK_CONFIG_DIR=$PWD/.clerk` and `CLERK_PLATFORM_API_KEY` — env
   keys outrank any global `clerk auth login`, so this account never leaks
   outside the repo. Eric creates the Platform API key (Clerk dashboard →
   workspace settings → Platform API keys) and fills in the commented line.
2. **Production-instance DNS on traduz.co:** fetch the required records via
   the CLI (`clerk deploy status` / domains API), add them in Cloudflare as
   **DNS-only (unproxied)** CNAMEs, wait for Clerk validation.
3. In Clerk dashboard, allowed origins for the dev instance:
   `http://localhost:5173` (or the Start dev port), `https://traduzco.pages.dev`,
   later `https://dev.traduz.co`.

## Out of scope

- Real marketing/attract design (placeholder copy only).
- Clerk production instance + its traduz.co DNS records.
- Backend/user data/content gating (the game stays statically reachable).
- dev./staging. subdomains and a formal multi-env deploy workflow (Eric's
  stated future project).
- Migrating the game's mastery persistence to user accounts.
