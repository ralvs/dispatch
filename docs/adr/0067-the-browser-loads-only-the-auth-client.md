# The browser loads only the auth client

Date: 2026-09-30

`SessionKeeper` built the full `@supabase/ssr` browser client on every route
(issue #7). ADR-0062 left that on purpose: deferring the client would start the
refresh ticker late, and ADR-0025 and ADR-0032 need the browser to refresh
before the request fan-out.

Deferring was never the only way to shrink it. The browser calls `auth.*` and
nothing else: `SessionKeeper`, the sign-in form and the sign-out button. It
never queries PostgREST, Storage, Realtime or Functions, yet the full client
bundles all four.

## Decision

1. **`lib/supabase/browser.ts` builds a `GoTrueClient` from
   `@supabase/auth-js`, not a full client.** It passes the options
   `createBrowserClient` passes to auth: PKCE, auto refresh, session in URL,
   persisted session, and the default `sb-<ref>-auth-token` storage key. No
   `lock` is passed, as before. It is a singleton only in the browser, as
   before.
2. **The cookie adapter is `@supabase/ssr`'s own `createStorageFromOptions`**,
   with `base64url` encoding and `AUTH_COOKIE_OPTIONS`. The package does not
   export it from its root, so the import reaches into
   `@supabase/ssr/dist/module/cookies`. Copying it would let the format drift
   from what the proxy and `requireOwner()` read.
3. **`@supabase/auth-js` is a direct dependency. It and
   `@supabase/supabase-js` are both pinned exact, to the same version.** Bump
   the two together, or the server and the browser run different auth code.
4. **The client is still built in the same `useEffect`, at the same time.**
   Nothing about when the ticker starts changes, so the reason ADR-0062 gave
   for leaving this alone does not apply.

## Proof

- `lib/supabase/browser.test.ts`: a session the thin client writes is read by
  `createServerClient`, and the reverse. It also pins the cookie name and the
  `base64-` encoding. A wrong storage key or encoding fails it.
- `test/e2e/session-refresh.spec.ts`, on the production build: an expired
  session on `/sign-in` (outside the proxy matcher) is refreshed by the
  browser with a 200 from `/token`, the refresh token rotates, and the owner
  lands on `/today` with no password.
- The auth chunk dropped from 237 KB to 117 KB raw, 61 KB to 28 KB gzip.

## Consequences

- An `@supabase/ssr` upgrade can move or change the internal `cookies` module.
  The type check fails if it moves, and the unit test fails if its format
  changes.
- If the browser ever needs a data query, it needs the full client again.
  Import it where the query is, not here, so the auth path stays small.
- A cold PWA launch on the phone is the one check a test cannot make. Do it
  once after this ships.
