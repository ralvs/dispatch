# Cache Components with tagged data for a single-user ops app

> **Superseded for day navigation (2026-07-31).** Decision 4's `day-schedule`
> segment is no longer read on the day-nav path, and Decision 7 is narrowed:
> day bands are now read uncached on the RLS client, because the cached copy
> could lag what SSR had already painted. Freshness for day nav moved to a
> client-side cache — see
> [ADR-0034](./0034-the-client-owns-navigation-freshness.md). `today-chrome`
> and `settings` are unaffected.

## Context

Phases 1–5 cut auth RTT, day-nav cost, client RSC retention, and optimistic
UI. First visits and SoftRefresh still re-ran the Today chrome fan-out
(~11 queries) every time. Next.js 16 Cache Components (`cacheComponents` +
`"use cache"` + `cacheTag`) are the platform fit — not React Query.

Constraints specific to Dispatch:

- Every authed route reads cookies for session and theme.
- Services take an RLS `SupabaseClient`; `"use cache"` cannot close over
  cookie-bound clients.
- Single owner: app-level `requireOwnerPage()` is the boundary (ADR-0003),
  not row-level `auth.uid()` filters.

## Decision

1. Enable `cacheComponents: true`.
2. Remove `cookies()` from the root layout: theme is applied by an inline
   script reading the `theme` cookie before paint (same FOUC budget as SSR).
3. Wrap the authed shell's `requireOwnerPage()` in `<Suspense>` so the dynamic
   auth hop does not block the Cache Components static shell rules.
4. Cross-request data cache lives in `lib/cache/*`:
   - `today-chrome` — quotes, projects, routines, domain cadence, counts
   - `day-schedule` — open tasks + events (short TTL)
   - `settings` — timezone
5. Cached loaders use `createAdminClient()` **only after** the page/action has
   passed `requireOwnerPage()`. Single-user; no multi-tenant bleed.
6. `afterMutation` calls `revalidateTag(tag, "max")` alongside
   `revalidatePath` so both the data cache and the client router stay honest.
7. Schedule inputs for "today" stay as fresh as SoftRefresh needs: chrome is
   the expensive cached segment; wall-clock "now" assembly stays outside long
   TTLs where it matters.

## Consequences

- First paint after a warm chrome cache skips the 11-query cold segment.
- Task checkbox invalidates `day-schedule` (and still revalidates paths);
  quote edit invalidates `today-chrome` without thrashing schedule.
- Admin-in-cache is a deliberate single-user exception, not a general pattern
  for multi-tenant apps.
- Full PPR of authed HTML is not the goal — dynamic auth remains; we cache
  *data*, not the security decision.
