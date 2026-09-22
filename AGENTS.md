# Dispatch

Single-user personal operations dashboard PWA. Text capture, editorial
newspaper design, one pane of glass. Functional reimplementation of
[jerad-ops](https://github.com/ralvs/jerad-ops) on a different stack, owned by
Renan Alves (renan@alves.id).

Cross-project preferences — orchestration, commit and review workflow, stack
defaults, communication style — live in `~/.claude/CLAUDE.md` on Renan's
machine. Claude Code loads that file automatically in every project; other
agents should read it once at the start of a session. This file covers only
what is specific to Dispatch, and wins where the two disagree.

## Stack

- **Next.js 16** (App Router, Turbopack) — single app, no separate API server
- **Bun** (package manager + scripts), **Biome** (lint + format, tabs, width 100), **TypeScript strict**
- **Tailwind CSS v4** — tokens in `app/globals.css` `@theme inline`; semantic names only (`bg-bg`, `text-ink-3`, `border-line`, `text-accent-slip`)
- **Supabase** — Postgres + Auth + Storage; migrations in `supabase/migrations/`
- **Vercel AI SDK via AI Gateway** — one `AI_GATEWAY_API_KEY`, no provider keys; models in `lib/env.ts`
- **Luxon** for all date math; **Vitest** + React Testing Library, tests colocated (see Testing)

## Iron rules

Canonical statement and rationale: `docs/adr/0041-the-iron-rules.md`. Mirrored
here because these six are worth carrying in context; the ADR wins on conflict.
The numbering is a stable interface — cited by number across the codebase,
never reordered.


1. **UTC in storage, app timezone at the boundary.** Every persisted timestamp
   is UTC (`timestamptz`). Day boundaries, display, and natural-language date
   parsing go through `lib/dates.ts` with the timezone from `app_settings`
   (America/Sao_Paulo). Never raw `new Date()` math for calendar logic.
2. **`requireOwner()` is the security boundary** — first line of every server
   action and session route handler. `proxy.ts` only refreshes sessions and
   redirects page loads. External endpoints use `lib/secret-auth.ts`
   (timing-safe). There is no unauthenticated surface.
3. **Services take `sb` as the first argument** so the same function runs
   RLS-scoped (pages/actions) or service-role (cron/capture).
4. **Never lose a capture.** The capture pipeline degrades to a `needs_review`
   note rather than dropping input. AI calls return typed fallbacks, never
   throw into the capture path. Capture is text-only (docs/adr/0017).
5. **Bilingual PT-BR/EN.** Content is stored verbatim in the language written —
   never translated. UI chrome is English.
6. **Every autonomous/external action writes a `notifications` row.**

## Testing

Five layers (docs/adr/0063). Tests sit next to the code they test.

| Layer | File | Covers | Runs in |
|---|---|---|---|
| Static | — | types, lint (Biome, `tsc`) | `bun run check` |
| Unit | `*.test.ts` | pure logic: dates, recurrence, parser, reducers, the store | `bun run check` |
| Component | `*.test.tsx` | client components, in happy-dom | `bun run check` |
| Integration | `*.int.test.ts` | services and server actions against real Postgres + RLS | `bun run test:integration` |
| End-to-end | — | async Server Components, critical flows (Playwright, #10) | not yet |

- Integration needs Docker and the local stack: `supabase start`, then
  `bun run test:integration`. After you add a migration, run
  `supabase db reset` first — the reset baseline refuses a moved schema.
- Every table is reset before each integration test. Clients come from
  `test/integration/clients.ts`: `ownerClient()` (RLS, seeded owner),
  `serviceClient()` (secret key), `anonClient()` (no session).
- Do not stub Supabase query chains in new tests. Behaviour against the
  database is an integration test.
- Component tests do **not** run through the React Compiler. Write components
  that are correct without it; the compiler only memoizes.
- The AI gateway is always faked. No test makes a paid call.

## Conventions

- `bun run check` must be green before every commit
- Read `docs/adr/` before changing direction; new ADR whenever a decision
  deviates from the reference implementation or this file
- `app/api/` is for external HTTP surfaces only — everything else is a server
  action behind `requireOwner()`
- Conventional Commits; incremental commits per logical group; author
  `Renan Alves <renan@alves.id>`
- Reference implementation (feature semantics, prompts, schema shape):
  https://github.com/ralvs/jerad-ops
