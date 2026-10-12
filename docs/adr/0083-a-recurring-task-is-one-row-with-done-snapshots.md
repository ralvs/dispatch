# A recurring task is one row, with done snapshots

Date: 2026-10-12

Supersedes ADR-0059's "the rule moves with the series", "the star follows the
series" and its note-links consequence. ADR-0059's goal stands: a past day
shows the cycle that was done on it.

## Context

Under ADR-0059 a tick closed the recurring row and inserted its successor with
a new id. The live task changed id every cycle, so URLs, note links, assistant
(MCP) references and Memex sources all stayed on an old, finished row. No
column linked the rows of a chain, so "every time I did X" had no clean
answer (#127).

## Decision

**The recurring task is one permanent row.** It keeps its id, title, notes,
rule and links. A tick does two writes in one Postgres function,
`complete_recurring_task`:

1. Insert a **done snapshot**: a copy of the row with `status = done`,
   `completed_at` = now, `recurrence_rule = null`, `due_date` = the cycle it
   fulfilled, and `series_id` = the recurring row's id.
2. Move the recurring row's `due_date` to the next cycle. It stays open.

`where series_id = X` is the history of X. The snapshot carries
`completed_at`, so the day bands (ADR-0038) still show it ticked on the day it
was ticked.

**The app computes the date; the database does the gated writes.** The next
date comes from `lib/recurrence.ts` (`nextCompleteFields`), as before. The
functions take it as an argument. Each one is gated on `status = open` and on
the due date the caller saw (ADR-0037), so a replay — a second tab, a stale
render, a double click, an assistant's retry — finds the date moved and
writes nothing. No second snapshot, no skipped cycle.

**Un-tick.** The latest snapshot of a series is the exact inverse of its tick:
`untick_recurring_snapshot` gives the row back the snapshot's due date, star,
`recurrence_day` and `reminders_sent`, then deletes the snapshot. "Latest"
means no other row of the series has a later due date, or the same due date
and a later `created_at`. An older snapshot is history: un-ticking it reopens
it as a plain task, and the series row does not move.

**Skip.** `skip_recurring_task` moves the row to its next cycle and saves no
snapshot. Same gate. It is a control beside the star on Tasks, Today and a
project page, and the `skip_task` MCP tool.

**The snapshot copies `reminders_sent` and `recurrence_day`.** The issue said
the snapshot takes the column default for `reminders_sent`. It copies the
row's value instead, so an un-tick can put the row back exactly as it was. A
done row is never reminded, so the copy changes nothing else. The recurring
row's `reminders_sent` resets when it moves.

**The star.** The snapshot keeps `top3_for_date`, so it stays in the Top 3 of
the day it was ticked, ticked. A starred row's star follows it to its new due
date.

**Mentions** on the snapshot are re-derived from its text (ADR-0030). A failed
re-derive does not undo the tick; the next edit heals it.

**The client names the snapshot.** A row tap sends a `snapshotId`
(`crypto.randomUUID()`). The entity store shows the moved row and the
snapshot at once, and the server writes the snapshot under that id, so the
confirmed write lands on the rows already shown (ADR-0069). Without an id —
the MCP tool — the server picks one and the snapshot arrives with the write.

**MCP.** `complete_task` and `skip_task` join the task tools. This amends
ADR-0079's "completing stays in the app". Both take the due date the
assistant last read, which is the gate above; deleting still stays in the
app.

## Consequences

The live task never changes id. Links, URLs and assistant references to it
stay good. A note linked to a recurring task follows it through every cycle;
a note about one cycle belongs on that cycle's snapshot.

Existing chains need no data change. Each open recurring row becomes its
series row. Old done rows keep `series_id = null`; there is no backfill.

`tasks` still grows one row per tick. Deleting the series row sets its
snapshots' `series_id` to null; they stay as plain history.

The checkbox on a recurring row is empty again right after a tick, as it was
before ADR-0059. ADR-0071 point 4 no longer holds for recurring rows: a fast
second click would tick the next cycle, and the server's gate cannot tell,
because that click saw the new due date. So a second tick or skip on the same
recurring row within 800 ms counts as the same click
(`lib/task-interaction/run-intent.ts`). It is a client guard, not a lock: it
never blocks the store, and a deliberate tick a second later goes through.

An older snapshot reopened as a plain task keeps its `series_id`, so a
re-tick puts it back in the history. The history of X is therefore the
**done** rows `where series_id = X`, and only done rows count when the
un-tick asks which snapshot is the latest. The un-tick locks the series row
before it asks, so a tick cannot land in between.

An un-tick happens after a skip too: it moves the task back to the cycle it
un-ticked, as the issue states, and the skip is lost.

The client cannot tell whether a reopened snapshot is the latest, so the
snapshot leaves every view until the server answers. Shown as an open task
meanwhile, it would be a second copy of the series to tick. The server
returns the moved-back row, or the snapshot reopened as a plain task. The
overdue counter's move back is left to the next seed.

Upcoming cycles ("shadow tasks", shown dimmed on future days) are a
follow-up: computed at read time from the rule and the due date, never
stored.
