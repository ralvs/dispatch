# The ledger owns its delivery and tags

Date: 2026-10-04

Two live bugs shared one cause: every caller of `recordNotification` decided
part of what a ledger row means. The sweep and observations crons called it
bare, so a ledger failure turned a finished sweep into a 500, while the capture
route wrapped it in try/catch. And push read `push_subscriptions` through the
caller's `sb`, which RLS closes on session paths, so a palette capture that
booked an event never pushed. Each caller also had to remember to bust
`notification.write`, and a source-grep test pinned which ones did.

## Amends

- ADR-0005: "only a service-role `sb` pushes." Every committed row now pushes.
- ADR-0001: services stay free of Next, with one named exception (§3).

Builds on ADR-0015.

## Decision

1. **`recordNotification` is best-effort and never rejects.** It resolves the
   row, or null when the row did not land (logged). `recordNotificationOrThrow`
   is for entries that are the delivery — a fired reminder — and resolves only
   once the row is committed, so `markRemindersSent` runs after it.
2. **Every committed row is pushed through the service-role client**, whatever
   client the caller passed. `sb` scopes only the insert (iron rule #3).
   `push_subscriptions` stays service-role-only: no RLS policy, no caller flag.
3. **The module busts `EXTERNAL_WRITES.ledger` itself**, with
   `revalidateTag(tag, "max")` through `afterExternalMutation` — legal in route
   handlers and server actions; never `updateTag`. It is the one service that
   reaches `next/cache`. The bust never throws (Next throws without a request
   scope; the module logs it), and a unit test in `lib/invalidate.test.ts`
   guards that no other service imports `next/cache` or `@/lib/invalidate`.
4. **Callers neither wrap the call nor bust the ledger's tags.** The tag bust
   and the push run only after the row lands, and neither reaches the caller.
5. **Who announces a failed calendar sync is left to the calendar mirror**
   (AC-09). The bridge's failure row only moves onto the new API.

## Consequences

- `cronObservations`, `cronReminders` and `calendarBridgeFailure` leave
  `EXTERNAL_WRITES`; the other writers drop `"notification.write"`. Cached
  readers name `ledger` as the external writer of the notification tags.
- Never call either function from render or a `"use cache"` scope.
