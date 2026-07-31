# The client owns navigation freshness

Date: 2026-07-31

Supersedes ADR-0033 Decision 4 in part (the `day-schedule` segment) and
narrows Decision 7.

## Context

ADR-0033 cached day bands server-side so a Today day-nav chevron was cheap.
Navigation still degraded in two ways:

- Flipping to a day already visited re-ran the Server Action every time, and
  the client kept no memory of it.
- `experimental.staleTimes.dynamic` was 30s, so a tab revisit past that
  window dropped to `loading.tsx` and re-fetched the whole tree.

Three facts about Next.js 16.2.10, read from the installed source rather than
inferred, shaped what was possible. They are recorded with file:line in the
header comment of `lib/mutation-feedback/invalidate.ts`; the short form:

1. **There is no route-level stale-while-revalidate.** A navigation reads the
   BFCache with the real clock, so an expired entry is *deleted* and the
   loading boundary shows. Back/forward passes `-1` to bypass staleness, which
   is why browser Back feels different from a tab tap.
2. **`router.refresh()` is global.** It bumps a module-level cache version, so
   every route's entry expires — "refresh this tab in the background" would
   evict the other four.
3. **`revalidatePath` wipes the entire client cache; `revalidateTag(t, "max")`
   wipes none.** The client cost is binary per action, not per path. So the
   effective instant window was never 30 seconds — it was "until your next
   write."

A fourth fact was found in review, and is why Decision 2 below exists: the
day-nav Server Action read `getCachedDaySchedule` (admin client, `cacheLife`
expire 180s) while `briefing-body` read `getDaySchedule` uncached on the RLS
client. Two sources for the same data. Nothing under `app/api/` invalidates
anything, so the caldav cron writes `calendar_events` without busting
`day-schedule` and the cached copy can lag what SSR already painted.

## Decision

1. **Day navigation keeps its own client-side cache**, keyed by `dateIso`
   (`lib/day-nav/revalidation.ts`). A cached day paints instantly; if its entry
   is older than 60s a background refetch runs and is adopted only when a
   signature says the content actually moved. The background path deliberately
   skips `startTransition`, which is what keeps the pending dim attached to
   real cache misses.
2. **The day-nav Server Action reads uncached, on the RLS client** — the same
   read `briefing-body` performs. The two must not disagree. This retires
   `day-schedule` as a live cache segment for that path.
3. **The signature is split into `content` and `time`.** `nowUtcIso` is
   recomputed on every request, so naive equality would report "changed" every
   time. Splitting also lets a write be distinguished from a clock tick: when
   `content` moves on a prop sync, the other cached days are dropped rather
   than waiting out the timer. `nowLabel === null` is the "not today" signal,
   so the time component is inert off-today.
4. **`staleTimes` is `{ dynamic: 300, static: 300 }`**, matching SoftRefresh's
   own interval. This buys a longer instant window, not background refresh —
   per fact 1, the latter is not available for route navigation.
5. **No refresh-on-arrival, no `prefetch={true}`.** Fact 2 makes the first
   strictly worse than doing nothing. ADR-0028's cost objection to the second
   still holds: visible links are rescheduled on every tree change *and* every
   invalidation, so a 5-link dock would pay up to four extra full renders per
   tap.

## Consequences

- Day navigation is instant on revisit and self-correcting within 60s, with no
  loading state on a day already seen.
- Tab navigation is instant for 5 minutes **between writes**. Because any
  `revalidatePath` evicts the whole client cache, you can never see your *own*
  write go stale; only the caldav and reminders crons can drift, and `/today`
  self-refreshes on the same cadence.
- `lib/cache/briefing.ts` now has three unused exports — `getCachedDaySchedule`
  (orphaned by Decision 2), plus `getCachedBriefing` and
  `getCachedDayScheduleInputs`, which were already unused before it. Dead code
  to remove, not a cache to reinstate.
- Nine of the twelve tags in `lib/cache/tags.ts` are still consumed by nothing.
  Wiring them to `"use cache"` reads is what would let the matching
  `revalidatePath` calls become `revalidateTag` and stop wiping the client
  cache on every write. That is the remaining unlock, and it changes *when* a
  write becomes visible — so it needs its own ADR.
- Cron and external API routes invalidate nothing at all (`afterMutation` has
  zero call sites under `app/api/`). Decision 2 removes the sharpest edge of
  that, but the gap itself is open.
- Freshness for the day bands now costs two indexed queries per uncached fetch.
  The client cache, not the server one, is what makes repeat visits free.
