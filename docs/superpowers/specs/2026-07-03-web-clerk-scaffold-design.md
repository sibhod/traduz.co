# traduz.co Web App Scaffold (Clerk auth) — Design

**Date:** 2026-07-03
**Status:** Awaiting review

## Goal

Turn `apps/web` from a static placeholder into the scaffold of the real
traduz.co app: a marketing/attract page at `/` with sign-up/sign-in (Clerk),
and an authenticated `/home` page users land on after auth. Scaffolding only —
real marketing design and real /home features come later.

## Decisions

Eric was away for the framework question; all four calls below are
best-judgment and flagged for veto:

1. **React SPA (best judgment — veto if wrong).** `apps/web` becomes
   Vite + React 19 + react-router 7 + `@clerk/clerk-react`. Clerk's
   first-class SDK is React (`<SignInButton>`, `<UserButton>`,
   `<SignedIn>/<SignedOut>` out of the box); the app will keep growing
   account-facing UI, so the framework earns its keep now. Alternatives
   considered: staying vanilla TS with `@clerk/clerk-js` (fewer deps, but
   hand-rolled routing/guards/mounting forever), and a meta-framework
   (Next/Astro — better marketing SEO later, but changes the static-compose
   deploy story; revisit when marketing actually matters). The game app is
   untouched Pixi.
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
├── package.json            # + react, react-dom, react-router, @clerk/clerk-react; @vitejs/plugin-react
├── vite.config.ts          # + react() plugin; base './' unchanged
├── tsconfig.json           # + "jsx": "react-jsx" (only compiler addition)
├── index.html              # <div id="root"> + module script src/main.tsx
└── src/
    ├── main.tsx            # mount: ClerkProvider (key from env, fail fast) → BrowserRouter → App
    ├── App.tsx             # routes: / → Landing, /home → RequireAuth(Home)
    ├── pages/Landing.tsx   # attract placeholder: h1, tagline, SignUp/SignIn modal buttons; SignedIn users see a "Go to home" link instead
    ├── pages/Home.tsx      # UserButton + APPS registry cards
    ├── components/RequireAuth.tsx  # <SignedIn>{children}</SignedIn> + <SignedOut><RedirectToSignIn/></SignedOut>
    ├── apps.ts             # registry paths become ABSOLUTE ('/mata-el-torre/') — relative paths mis-resolve from /home/-style URLs now that routes exist
    └── apps.test.ts        # updated to assert absolute-with-trailing-slash paths
```

- **Env:** `VITE_CLERK_PUBLISHABLE_KEY` read via `import.meta.env`;
  `main.tsx` throws a clear error at boot if missing. Locally:
  `apps/web/.env.local` (gitignored — already covered by `.env.*`). CI: a
  GitHub Actions **repository variable** (`vars.VITE_CLERK_PUBLISHABLE_KEY`,
  not a secret — the key is public by design) exported in the build step.
- **Routing on static hosting:** BrowserRouter (clean URLs). Deep links like
  `/home` work via Cloudflare Pages' built-in SPA fallback (unmatched paths
  serve the root `index.html`). **Constraint: never add a catch-all
  `_redirects` rule** — Pages redirects outrank static assets and a `/*`
  rule would swallow `/mata-el-torre/`.
- **Base path:** stays `'./'`… with one change: react-router's BrowserRouter
  needs absolute asset URLs to survive deep links (`/home` would otherwise
  request `./assets/…` relative to `/home`). So `apps/web` switches to
  `base: '/'` (it is always served at the domain root — the relative base
  was only load-bearing when it might live at a subpath). The game keeps
  `base: './'` since it lives at a subpath.

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
- `RequireAuth` and Landing/Home rendering: component tests with
  `@testing-library/react` + jsdom, mocking `@clerk/clerk-react` exports
  (SignedIn/SignedOut render/hide children based on a mocked auth state) —
  tests real routing/guard wiring without Clerk network calls.
- Manual verification: full modal sign-up → `/home` flow on a Clerk dev
  instance, locally and on the deployed site.

## One-time setup (Eric, manual)

1. Create a Clerk application (dashboard.clerk.com), development instance;
   enable email (+ Google if desired).
2. Copy the publishable key (`pk_test_…`) into:
   - `apps/web/.env.local` → `VITE_CLERK_PUBLISHABLE_KEY=pk_test_…`
   - GitHub repo → Settings → Variables → Actions →
     `VITE_CLERK_PUBLISHABLE_KEY`
3. In Clerk dashboard, add allowed origins: `http://localhost:5173`,
   `https://traduzco.pages.dev`, `https://traduz.co`.

## Out of scope

- Real marketing/attract design (placeholder copy only).
- Clerk production instance + its traduz.co DNS records.
- Backend/user data/content gating (the game stays statically reachable).
- dev./staging. subdomains and a formal multi-env deploy workflow (Eric's
  stated future project).
- Migrating the game's mastery persistence to user accounts.
