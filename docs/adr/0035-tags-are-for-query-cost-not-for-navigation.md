# Cache tags buy query cost, not navigation; external routes must bust them

Date: 2026-08-02

Corrects a claim in [ADR-0034](./0034-the-client-owns-navigation-freshness.md)
and closes the invalidation gap that ADR listed as open.

## Context

ADR-0034 left two follow-ups. Both are settled here, in opposite directions.

**The gap.** `grep -rn afterMutation app/api/` returned nothing across all
eight route handlers. The three crons, the external capture surface, and the
calendar bridge all write rows that `getCachedBriefingChrome` reads —
`unreadCount` behind the masthead badge, `countNeedsReview` and
`unreadLinkCount` behind the alerts row. That entry has `cacheLife` expire 600,
so the Today numbers could lag a cron write by ten minutes. This is also what
made the bug fixed in `840e31d` reachable.

**The claim.** ADR-0034 recorded that wiring the unused tags to `"use cache"`
reads was "the remaining unlock" — that it would let `revalidatePath` calls
become `revalidateTag` and so stop wiping the client router cache on every
write. That is not achievable. Read from the installed Next 16.2.10 source:

- `revalidate.js:207-212` — `revalidateTag(t, "max")` deliberately leaves
  `pathWasRevalidated` unset. Next's own comment: "if profile is provided and
  this is a stale-while-revalidate update we do not mark the path as
  revalidated so that server actions don't pull their own writes."
- `action-handler.js:901` — unset ⇒ `skipPageRendering`, so the action returns
  **no fresh RSC payload**.
- `server-action-reducer.js:192-208` — set ⇒ `invalidateBfCache()`, globally.

One flag, two consumers. "Navigation stays cached across writes" and "my own
write lands on screen" are the same switch in opposite positions. No amount of
tag wiring separates them, because nothing in between exists: `revalidateTag`
*without* a profile sets the flag and wipes the client cache exactly as
`revalidatePath` does. With seven `useOptimistic` sites in this app, the
position is not in question — a write that visibly undoes itself is far worse
than a skeleton on a tab tap.

## Decision

1. **Route handlers invalidate tags only.** New `afterExternalMutation(...kinds)`
   in `lib/mutation-feedback/invalidate.ts`, wired into `app/api/cron/*`,
   `app/api/capture`, and `app/api/calendar/bridge`. Tags only is deliberate:
   cron-job.org and the iOS Shortcut have no client router cache for
   `revalidatePath` to evict and no `useOptimistic` transition awaiting a fresh
   RSC payload, so the path half would only cost a render nobody reads.
2. **Invalidation is a table, not a switch of side effects.** `invalidationFor(kind)`
   is pure and unit-tested (`invalidate.test.ts`); `afterMutation` applies tags
   **and** paths, `afterExternalMutation` applies tags only. One source of truth
   for both entry points.
3. **Only act when rows moved.** A cron tick reporting no work invalidates
   nothing, so a quiet tick never discards a warm cache. Reminders bust on a
   fired reminder but not a suppressed one, which stamps `reminders_sent` and
   renders nowhere.
4. **Tags are wired for query cost.** `/tasks`, `/notes`, `/links` now read
   through `lib/cache/{tasks,notes,links}.ts`. The justification is fewer
   Postgres round-trips per visit — **not** navigation, which Decision 0 above
   establishes tags cannot buy.
5. **Nothing time-derived goes in a cached entry.** `todayIso` stays computed
   per request from the timezone, so an entry outliving midnight cannot paint
   yesterday's overdue set.
6. **`revalidatePath` stays on every Server Action.** Per the same flag, it is
   what returns the fresh RSC payload each `useOptimistic` site settles into.

## Consequences

- The Today masthead badge, alerts row, and links count now reflect an external
  capture or cron write on the next page load instead of up to 600s later.
- `/tasks` drops from seven queries per visit to zero on a warm entry; `/notes`
  two; `/links` one. Between writes only — any write to that domain busts it,
  which is the correct trade for a single-user app that must never lie.
- Wiring `/links` was only safe *after* Decision 1: the reading pile is filled
  mostly from outside the app. Same for the `needs_review` note band and the
  sweep cron. Ordering here was load-bearing, not incidental.
- Seven tags remain consumed by nothing: `day-schedule` (orphaned when `38df3e3`
  removed its last reader), `routines`, `quotes`, `journal`, `people`,
  `projects`, `notifications`. Kept rather than deleted so the external write
  paths stay correct-by-construction if a cached read is ever added. They cost
  a map lookup.
- **ADR-0034's "remaining unlock" bullet is withdrawn.** Tab navigation is
  instant for 5 minutes between writes and cannot be made instant across them.
  That is a Next 16.2.10 property, not a Dispatch one — revisit only if
  `invalidateBfCache` learns the per-tag eviction its source already carries a
  TODO for.
- Not verified empirically: sign-out followed by browser Back. The source path
  says it is safe independently of `staleTimes` (`cache-map.js:131` gates on
  `version < currentCacheVersion`, and sign-out's `router.refresh()` bumps that
  version), but no one has clicked it. Left open.
