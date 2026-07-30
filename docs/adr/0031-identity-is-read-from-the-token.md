# Identity is read from the token, not the auth server

ADR-0025 measured ~40 `GET /user` calls in a two-second window on a single app
open — document, RSC segments, and a prefetch for every `<Link>` in the
viewport. ADR-0028's `loading.tsx` boundaries made that fan-out worse by giving
prefetch somewhere to land. Each of those calls sat on the critical path of
every navigation, and made Supabase Auth's availability a dependency of
rendering a page the database would already have authenticated via RLS.

## Decision 1 — `getClaims()` with no `jwt` argument

`proxy.ts` and `lib/auth.ts` call `supabase.auth.getClaims()` with no argument.
That form loads the stored session first, so a token inside its expiry margin
still refreshes and triggers `setAll` — the same rotation path `getUser()` used.
Passing the access token explicitly would skip refresh and break ADR-0025.

When the project signs with ES256 (confirmed live), verification is local
against a cached JWKS public key. No hop to `/auth/v1/user` on the happy path.
HS* or a missing `kid` falls back to `getUser()` inside auth-js — today's
behaviour exactly.

## Decision 2 — guards return `claims`, not a faked `User`

`requireOwner()` / `requireOwnerPage()` return `OwnerAuth = { claims, sb }`.
`claims.sub` is the owner id; `claims.email` is the only other claim the UI
reads (desktop rail, `/more`). Inventing a `User`-shaped object would make
`user.user_metadata` typecheck and be `undefined` at runtime.

Call sites that only needed `sb` are unchanged by destructuring key names.

## Decision 3 — one identity read per request

`cache()` lives on the shared `currentClaimsAndClient` helper, not on each
guard. Layout + page + nested loaders share one verification. Each denial
builds its own `NextResponse` (caching the denial response itself risked
sharing one body across two callers).

## Decision 4 — what we gave up

Local verification means a revocation from another device takes up to one
access-token TTL (1 hour, unchanged) to land, versus next-request with
`getUser()`. The refresh token is still revoked instantly, so the window cannot
grow. For one owner UUID that is acceptable.

**This does not fix the cold-start PWA logout.** `getClaims()` and `getUser()`
share the same session-load / refresh path; the refactor removes a network call
on identity, not the refresh-token race ADR-0025 describes.

## Consequences

- ADR-0003 stands: the security boundary is still `requireOwner()` /
  `requireOwnerPage()` as the first line of session-authed work. Only the
  mechanism inside the boundary changed.
- Supabase Auth leaves the hot path (one JWKS fetch per isolate per ~10 min vs
  one `/user` per request).
- Every failure mode fails closed: no session, bad signature, expired `exp`,
  JWKS unreachable, missing `sub`, unset `OWNER_USER_ID` → deny.
- Rejected alternatives: explicit `jwt` (skips refresh); `allowExpired`; a
  second `role === "authenticated"` assertion on the boundary; a shorter TTL
  (would make cold-start logout more frequent until that is fixed separately).
