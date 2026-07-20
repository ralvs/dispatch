# One Next.js app; the service layer is the API

The reference ran a separate Fastify server that the web app called through a
1300-line typed fetch wrapper. Dispatch is a single Next.js app: server
components and server actions call `lib/services/*` directly — no HTTP hop, no
wrapper. Only surfaces that external clients hit are route handlers under
`app/api/` (ingest, cron, widget, uploads, link share, streaming chat).

## Why

The API existed to serve one web app plus a handful of webhooks. Keeping ~100
internal endpoints alive costs serialization, auth plumbing, and deploy
surface while buying nothing a direct function call doesn't. Every service
takes a `SupabaseClient` as its first argument, so the RLS/service-role split
survives without a network boundary. If an external client ever needs the full
surface, handlers are thin wrappers over the same services.
