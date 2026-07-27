# Session refresh runs in the browser, not only in the proxy

ADR-0003 left token refresh to `proxy.ts` and called it "the single writer of
rotated refresh-token cookies". That premise was wrong, and it logged the owner
out of the installed PWA roughly once per session.

Two changes:

1. `components/session-keeper.tsx` mounts the `@supabase/ssr` browser client in
   the authed layout. auth-js then refreshes on its own expiry-margin ticker
   while the app is visible, refreshes again on `visibilitychange` when iOS
   resumes the PWA, and serializes those refreshes behind `navigatorLock`.
2. `createRlsClient()` in `lib/auth.ts` persists rotated cookies instead of
   discarding them via a no-op `setAll`, falling back to a no-op only in Server
   Component renders where the cookie store is read-only.

## Why

Next middleware is not a single writer. It runs once per request, and one page
load fans out into many concurrent requests — document, RSC segments, and a
prefetch for every `<Link>` in the viewport (the bottom tab bar alone puts five
on screen). Supabase's auth logs for this project show ~40 `GET /user` calls
inside a two-second window on a single app open, each from a different lambda.

While the token is valid that fan-out is harmless. When it has expired it is
not: every one of those requests independently calls `/token` with the same
refresh token, and rotation makes all but one of them a reuse of a credential
Supabase has just revoked.

A desktop tab almost never reaches that state. It stays open, `SoftRefresh`
ticks every five minutes, and the token gets renewed by whatever single request
happens to notice — so it is never actually expired when a burst goes out. An
installed PWA is the opposite: iOS kills it while backgrounded, so every open
after an hour or more is a cold start whose first act is the burst, with an
expired token. That is the whole desktop/mobile asymmetry, and it matches the
observed pattern in `auth.sessions` — a successful refresh, then a fresh
password login three to seven seconds later, repeatedly, for days.

The no-op `setAll` compounded it. `getUser()` rotates from inside
`__loadSession` whenever the stored access token is within its expiry margin;
the `/token` call goes out and the old token is revoked regardless of what the
storage adapter does with the result. Swallowing the new token left the browser
holding a revoked credential and moved the logout one request later.

Refreshing in the browser fixes the ordering rather than the symptom: one
writer, holding a real lock, renewing the token *before* the requests that
depend on it are dispatched. The proxy keeps refreshing as the fallback for the
cold document request, which is genuinely serial.

## Consequences

The session cookies must stay readable from JavaScript (`httpOnly: false`),
which is already what `@supabase/ssr` writes at both ends. A Server Component
render that rotates still cannot persist the result; the proxy forwards fresh
cookies on `request` before the render starts, so this is now a narrow residual
case rather than the default path.
