# Dispatch

Single-user personal operations dashboard PWA. Text capture, editorial
newspaper design, one pane of glass. Functional reimplementation of
[jerad-ops](https://github.com/ralvs/jerad-ops) on a different stack, owned by
Renan Alves (renan@alves.id).

## Stack

- **Next.js 16** (App Router, Turbopack) — single app, no separate API server
- **Bun** (package manager + scripts), **Biome** (lint + format, tabs, width 100), **TypeScript strict**
- **Tailwind CSS v4** — tokens in `app/globals.css` `@theme inline`; semantic names only (`bg-bg`, `text-ink-3`, `border-line`, `text-accent-slip`)
- **Supabase** — Postgres + Auth + Storage; migrations in `supabase/migrations/`
- **Vercel AI SDK via AI Gateway** — one `AI_GATEWAY_API_KEY`, no provider keys; models in `lib/env.ts`
- **Luxon** for all date math; **Vitest** colocated `*.test.ts`

## Layout

```
app/            routes (App Router; (authed)/ group behind sign-in)
app/api/        external HTTP surfaces only (ingest, cron, widget, capture, chat)
components/     shared client components
lib/            env, dates, schemas, constants, supabase clients, ai, services
lib/services/   all business logic; every fn takes SupabaseClient as 1st arg
docs/adr/       architecture decision records — read before changing direction
supabase/       migrations + config
```

## Iron rules

1. **UTC in storage, app timezone at the boundary.** Every persisted timestamp
   is UTC (`timestamptz`). Day boundaries, display, and natural-language date
   parsing go through `lib/dates.ts` with the timezone from `app_settings`
   (America/Sao_Paulo). Never raw `new Date()` math for calendar logic.
2. **`requireOwner()` is the security boundary** — first line of every server
   action and session route handler. `proxy.ts` only refreshes sessions and
   redirects page loads. External endpoints use `lib/secret-auth.ts`
   (timing-safe). There is no unauthenticated surface.
3. **Services take `sb` as the first argument** so the same function runs
   RLS-scoped (pages/actions) or service-role (cron/ingest).
4. **Never lose a capture.** The capture pipeline degrades to a `needs_review`
   note rather than dropping input. AI calls return typed fallbacks, never
   throw into the capture path. Capture is text-only (docs/adr/0017).
5. **Bilingual PT-BR/EN.** Content is stored verbatim in the language written —
   never translated. UI chrome is English.
6. **Every autonomous/external action writes a `notifications` row.**

## Commands

- `bun dev` — dev server (Turbopack)
- `bun run check` — biome + tsc + vitest; must be green before every commit
- `bun run test` / `test:watch`

## Conventions

- Conventional Commits; incremental commits per logical group; author
  `Renan Alves <renan@alves.id>`
- New ADR in `docs/adr/` whenever a decision deviates from the reference
  implementation or this file
- Reference implementation (feature semantics, prompts, schema shape):
  https://github.com/ralvs/jerad-ops
