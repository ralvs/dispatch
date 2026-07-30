# PWA cold-start session recovery lives on /sign-in, not only the proxy

## Context

Phase 0 diagnosis (2026-07-30) against project `woiiepnagkzxinmkmbcx`:

- `security_refresh_token_reuse_interval` is already **10** (not 0) — the
  "reuse interval off" hypothesis is false.
- An iPhone session last refreshed at 15:47; the owner password-signed-in
  again at 21:05. The refresh token for the prior session was still
  **`revoked = false`**.

That signature is not "rotation race killed the token." It is "the server
bounced the PWA to `/sign-in`, and the client never tried to use the cookie
it still held (or could have refreshed serially)."

Three code facts made that bounce terminal:

1. **`SessionKeeper` only mounted under `(authed)/layout`.** A failed owner
   check never reaches it. The browser writer ADR-0025 relies on does not
   run on the sign-in page.
2. **`proxy.ts` matcher excludes `/sign-in`.** Landing there skips middleware
   refresh. Correct for avoiding redirect loops; wrong if nothing else
   recovers.
3. **Sign-in had no recovery path.** The form always asked for a password,
   creating a *new* session and leaving the old refresh token alive — exactly
   what the database showed.

Separately, auth cookie writers used @supabase/ssr defaults **without
`secure: true`**. On the HTTPS PWA that is a durability footgun: browser and
proxy must write identical attributes so chunked cookies never mix generations
(partial chunks decode to null and look like "logged out").

## Decision

1. Mount `SessionKeeper` on the **root** layout so every page, including
   `/sign-in`, starts the browser refresh ticker and `navigatorLock` writer.
2. On `/sign-in` mount, call `getSession()` once. If a session is recovered
   (serial browser refresh of a still-valid refresh cookie), `replace` to
   `/today` without asking for a password.
3. Share explicit cookie options (`path`, `sameSite: "lax"`, `maxAge`,
   `secure` in production, `httpOnly: false`) across browser, proxy, and RLS
   clients.
4. Apply `@supabase/ssr`'s cache-control headers in proxy `setAll` when auth
   cookies are written.

## Consequences

- A cold open that briefly fails the proxy check can self-heal on the sign-in
  page when cookies still exist — the dominant observed failure mode.
- If iOS has truly wiped cookies, password sign-in remains the path; recovery
  is best-effort and does not weaken `requireOwner()`.
- ADR-0025 stands; this closes the gap it left for "already redirected."
- Does not eliminate concurrent proxy refreshes on the first document request
  after a multi-hour kill; reuse interval 10s still absorbs that burst when
  cookies *are* present. Recovery is the safety net when the burst loses.
