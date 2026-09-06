# A routine day may be named by the client, inside a bounded window

`toggleCompletionAction` derived the completion date from the server clock and
said so in its own comment: the date is "never trusted from the client". That
rule kept a whole class of bug out — a device with a wrong clock, or a stale
tab from yesterday, could not write a completion onto the wrong day.

The shape plan (`docs/plan-dispatch-shape-2026-08-21.html` §07) asks for
backfill: the 30-day grid already drawn on every routine row becomes clickable,
so a day you did the thing but forgot to tick can be fixed. That is a real
reversal of a stated rule, so it is written down rather than slipped in.

## Chosen: accept a date, then bound it server-side

`toggleCompletionAction` takes an optional `date`. When absent it behaves
exactly as before. When present it must pass three checks, all server-side:

1. **A real calendar date** — `YYYY-MM-DD`, parsed, not merely shaped.
2. **Not in the future**, measured against the app-timezone today
   (`todayForRequest`, ADR-0002). You cannot tick tomorrow.
3. **Not older than 30 days**, which is exactly the window the grid draws.

The client therefore picks *which of the squares already on screen* to tick. It
never gets to invent a date the UI is not displaying, and it never gets to name
a date the server would not have offered. A wrong client clock can now move a
completion within a 30-day window, and no further.

Plan O4 settled the window: 30 days, "exactly the squares already on screen".
A wider one needs a date picker and a reason, and has neither.

## Why this costs nothing downstream

Streaks, rates and the grid are all recomputed from the completion log on read
(`lib/routine-stats.ts`) — no stored total goes stale when a past day changes.
This is the property that makes backfill a small change rather than a
reconciliation problem.

## Rejected

- **Keeping the server clock as the only writer.** It makes the grid furniture:
  30 squares you can read and cannot act on, on a page whose whole subject is
  whether you did the thing.
- **An unbounded date.** "Trust the client" and "bound the client" are not the
  same reversal. The second keeps most of what the original rule was for.
