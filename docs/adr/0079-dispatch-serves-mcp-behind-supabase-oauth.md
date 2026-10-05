# Dispatch serves MCP behind Supabase OAuth

Date: 2026-10-05

An assistant such as Claude should be able to read and work Dispatch's lists
the way the owner does, from the web, the desktop or the phone (issue #95).
The only external surface was `POST /api/capture`, which takes text behind a
shared secret and cannot answer a question. A shared secret also cannot be
handed to a hosted MCP client: Claude connects to remote servers through
OAuth. ralvs/echo already serves MCP this way and works with every Claude
client; its ADR-0011 (Supabase as the authorization server), ADR-0019 (the
consent page in the app) and ADR-0023 (discovery at the domain root, one
origin) are the lineage here.

## Decision

1. **Supabase Auth's OAuth 2.1 server is the authorization server.** Dynamic
   client registration is on, so a client registers itself; the owner signs
   in and approves it on `/oauth/consent`. A token is only as good as the
   account it was issued to, and the endpoint checks it against the same
   owner allowlist (`OWNER_USER_ID`) as every session. Sign-ups stay off.
2. **The token becomes an RLS client.** `requireOwnerBearer()` (`lib/auth.ts`)
   verifies the bearer token with `getClaims` and builds a supabase-js client
   from the publishable key and that token alone. Tools call the same services
   the pages do with that `sb` (iron rule #3), so an assistant acts as the
   owner and RLS still applies. It never reads cookies. This is the endpoint's
   boundary under iron rule #2 (docs/adr/0041).
3. **The server lives in the app, at `/api/mcp`.** No separate deployment and
   no proxy hop: a tool call reaches the services in the same function. It is
   stateless (`@modelcontextprotocol/server`'s `createMcpHandler`, a fresh
   server per request).
4. **Discovery answers at the root.** `/.well-known/oauth-protected-resource`
   and its path-inserted spelling are rewrites (`next.config.ts`) to
   `/api/oauth/protected-resource`, which names `/api/mcp` as the resource and
   Supabase's `/auth/v1` as its authorization server. A 401 from `/api/mcp`
   carries `WWW-Authenticate: Bearer resource_metadata=…` pointing there. The
   origin is read from the forwarded headers (`lib/mcp-origin.ts`).
5. **`proxy.ts` leaves the surface alone.** Its matcher excludes
   `.well-known`, `oauth/consent`, `api/mcp` and `api/oauth`. Each fails
   silently if dropped: discovery must answer JSON before any token exists,
   the consent page is reached signed out, and `/api/mcp` must not take part
   in cookie sessions.
6. **CORS is open and uncredentialed.** `Access-Control-Allow-Origin: *` with
   no credentials, so browser clients can connect and the app's cookies never
   count on this origin.
7. **Every write writes a ledger row.** A tool that changes a row records a
   `notifications` row (`mcp.*`) with an undo payload, which also pushes
   (iron rule #6, ADR-0075), and busts tags through its `EXTERNAL_WRITES`
   entry.
8. **The tool surface is small and grows by group.** Links first
   (`list_links`, `mark_link_read`); tasks and notes in follow-up PRs. Left
   out on purpose, per the issue: Today, capture, chat, journal, quotes,
   people, settings and notifications.

## Consequences

- Revoking a grant in Supabase does not stop it at once: `getClaims` verifies
  the signature locally, so an access token keeps working until it expires
  (`jwt_expiry`, an hour).
- The hosted project needs one-time dashboard setup (OAuth Server enabled,
  authorization path `/oauth/consent`, dynamic registration on, Site URL);
  `supabase/config.toml` covers only the local stack. See the README.
- An assistant's changes show up in the ledger and as pushes, so the owner
  sees what it did and can undo it.
- A new tool group adds a file under `app/api/mcp/tools/` and an
  `EXTERNAL_WRITES` entry; `lib/invalidate.test.ts` scans every file under
  `app/api`, not only `route.ts`.
