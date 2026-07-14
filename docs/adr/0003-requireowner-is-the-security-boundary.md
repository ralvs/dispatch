# `requireOwner()` is the security boundary, not the proxy

Auth follows Echo's ADR-0020 pattern. `proxy.ts` (Next 16 middleware) does UX
only: refresh rotated session cookies (single writer) and redirect
unauthenticated page loads to `/sign-in`. Authorization happens in
`lib/auth.ts#requireOwner()` — `auth.getUser()` from cookies, rejected unless
`user.id === OWNER_USER_ID` — called as the first line of every server action
and session-authed route handler. External endpoints (ingest, cron, widget,
link share) authenticate with timing-safe shared secrets via
`lib/secret-auth.ts`. Supabase Auth only; no Clerk or other auth vendor.

## Why

Middleware-as-authz is a known foot-gun: matchers drift, new routes slip
through, and Next has shipped middleware-bypass CVEs. A per-handler guard
fails closed. Single-user makes the owner check trivial: one UUID equality
after signature verification.
