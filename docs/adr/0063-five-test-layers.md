# Five test layers, and a local database for the middle one

Date: 2026-09-22

Changes the AGENTS.md convention "Vitest colocated `*.test.ts`". Part of #13
(issues #16 and #17).

## Context

The suite was ~890 tests, all unit. 24 of the 29 service test files stubbed
Supabase query chains by hand (`stubSupabase` in `lib/services/tasks.test.ts`)
and asserted on `.from().update().eq()` call shapes. Those tests break on every
refactor, and they cannot catch a wrong column name, an RLS gap, or a write
precondition that matches no row. There were no component tests: React
Testing Library was the stated house preference, but it was not installed.

The #13 epic changes every server action's return type (#22, #24). That work
needs tests that check behaviour, not call shapes.

Standing the local stack up found a real gap on the first run. No migration
granted the Data API roles anything on `public`. The hosted project was
created while Supabase still granted `anon`, `authenticated` and
`service_role` full access to new public tables by default, so it worked.
Newer Postgres images do not, so a fresh database built from our migrations
refused every query from the app. The stub-based tests could never have seen
it.

## Decisions

1. **Five layers, each with its own file name and command.**

   | Layer | Tool | File | Command |
   |---|---|---|---|
   | Static | Biome + `tsc` 7 | — | `bun run check` |
   | Unit | Vitest, node | `*.test.ts` | `bun run check` |
   | Component | Vitest + RTL, happy-dom | `*.test.tsx` | `bun run check` |
   | Integration | Vitest + local Supabase | `*.int.test.ts` | `bun run test:integration` |
   | End-to-end | Playwright, production build | (#10) | (#10) |

   Vitest cannot render async Server Components (Next.js docs), so those are
   covered end to end. The layers are Vitest `projects` in
   `vitest.config.mts`. `bun run check` runs unit and component only, so it
   stays fast and needs no Docker.

2. **Target mix, not a count.** Unit ~450–550 (pure logic: dates, recurrence,
   day schedule, mentions, wikilinks, parser, capture machine, stat bands,
   intent reducers, the store). Integration ~80–120. Component ~40–60.
   End-to-end ~15 (the skeleton smoke on every route and a few critical
   flows). These are estimates; #18 and #19 move the suite toward them.

3. **The local stack is the Supabase CLI.** `supabase/config.toml` is
   committed, and `supabase start` applies `supabase/migrations/`.
   `supabase/seed.sql` adds one owner with email and password, at a fixed id
   (`test/integration/stack.ts` names it). The seed is minimal and
   deterministic.

4. **Isolation is reset, not transactions.** Services talk to PostgREST over
   HTTP, one request per query, so a test cannot run inside a transaction
   that rolls back. Before each test, every public table is truncated and
   refilled from `test_baseline`, a copy of the public rows taken on the
   first run after the migrations. That keeps the rows the migrations seed
   (domains, `app_settings`, the welcome note). Triggers and FK checks are off
   while it runs. The baseline records the migration version it was taken
   at. If the schema moves, it refuses to run and asks for
   `supabase db reset`, because the tables may already hold test rows.
   Integration files run one at a time.

5. **The layer can only reach this machine.** Connection details come from
   `supabase status`, never from `.env.local`. Global setup fails on any
   host that is not `127.0.0.1` or `localhost`. `AI_GATEWAY_API_KEY` is
   deleted from the environment: the gateway is always faked.

6. **Three clients**, matching iron rule #3: `ownerClient()` (RLS-scoped,
   signed in as the seeded owner — what pages and actions pass),
   `serviceClient()` (the secret key — what cron and capture pass), and
   `anonClient()` (no session, to prove RLS closes the door).

7. **Grants are stated in a migration.**
   `20260922120000_explicit_public_grants.sql` grants the three Data API
   roles what the hosted project already had, privilege for privilege, and
   sets the same default privileges. On the hosted project it is a no-op.

8. **Component tests do not run through the React Compiler.** Vitest
   transforms TSX with Vite's own transform, not with
   `babel-plugin-react-compiler`. This was checked: the rendered `Dialog`
   carries no memo-cache calls. The compiler only memoizes, so a component
   that is correct without it passes here and in the app. `next/navigation` is
   mocked for every component test (`test/component/navigation.ts`). Server
   actions are mocked per test with `vi.mock`, because a `"use server"` module
   is just a module of async functions.

## Consequences

- A new service test goes in `*.int.test.ts` against the database. It does not
  stub query chains. #18 moves the existing stub-based tests.
- The first component test found a real bug. `Dialog` restored focus to its
  trigger before it removed `inert` from the shell, and a browser will not
  focus an inert element. So focus never came back after a dialog closed.
  The focus return now happens in the effect that removes `inert`.
- Contributors need Docker and the Supabase CLI for the integration layer
  only.
