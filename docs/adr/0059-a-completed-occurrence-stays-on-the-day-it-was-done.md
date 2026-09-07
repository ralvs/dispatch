# A completed occurrence stays on the day it was done

Date: 2026-09-07

## Context

Repeating tasks were one row that never closed. Completing one advanced
`due_date` to the next occurrence and left `status` at `open`; `completed_at`
was never written (ADR-0037 preconditioned that roll on the observed due date,
because it was the app's one non-idempotent write).

That model has no memory. Reported from the app: a weekly task ticked on
Friday, revisited on Friday, renders **unticked** — and, because it kept its
star, sits in that day's Top 3 reading `due in 8d`. Nothing was broken in the
tick. The row simply moved, and a past day has no way to ask what it looked
like at the time.

The failure is structural, not cosmetic. One row cannot describe a series: any
question about a past occurrence (was it done? when? what did its notes say?)
has no row to answer it.

Three ways out were considered:

1. **A completion log** — `task_completions(task_id, completed_date)`, the
   shape `routine_completions` already uses. Fixes history. Leaves every
   occurrence sharing one row's notes and edits.
2. **`last_completed_at`** — one column. Fixes only the most recent day.
3. **Materialise the successor** — close the row, create the next occurrence
   beside it.

## Decision

Option 3. Completing a recurring task closes the row it landed on and inserts a
new row dated at the next occurrence. A series is a chain of ordinary rows.

Three details carry the weight:

**The close is the gate.** `completeTask` reads the row, closes it guarded on
`status = open` (keeping ADR-0037's observed-due-date predicate), and inserts
the successor *only if that update actually moved a row*. A replay — second
tab, stale render, double click — finds the row already done and never reaches
the insert. Under the old model a replay cost a double roll; here it would cost
a duplicate occurrence, so the gate is load-bearing rather than defensive.

**The rule moves with the series.** The closed row's `recurrence_rule` is set
to null; the successor carries it. Re-opening a past occurrence and re-ticking
it is therefore an ordinary close — it cannot spawn a second successor, and the
series can never fork. Exactly one row in a chain is repeating: the newest.

**The star follows the series, not the finished row.** A successor spawned from
a starred occurrence is starred for its own due date. The closed row keeps the
star it had, which is what leaves it standing in the Top 3 of the day it was
ticked — ticked.

`reminders_sent` and `completed_at` reset by column default on the new row.
Mentions are not copied: `createTask` re-derives them from the same title and
notes, which keeps ADR-0030's rule that text owns the person graph.

The optimistic layer projects only the close. The successor has a
server-generated id, so it arrives with the RSC payload rather than being
guessed at on the client.

## Consequences

Past days are honest. A recurring task ticked on Friday is a done row dated
Friday, forever — surfaced by the same `completed_at` window that ADR-0038's
day bands already query. Each occurrence owns its own notes, edits and
completion instant.

`tasks` grows one row per completion. That is the cost, and it was accepted
deliberately: repeated titles in the table are not a problem worth normalising
away.

Sub-tasks are not carried forward, because there are none: ADR-0056 dropped
`tasks.parent_task_id` after it had never been set.

Note links (`note_links.target_task_id`) stay on the occurrence they were made
against and do not follow the series. This is deliberate — a note linked on
Friday is about Friday's occurrence — but it does mean a note is not carried
forward to the next one.

The `↻` glyph is gone from a completed occurrence, since the row no longer
holds a rule. History reads as plain finished tasks.

The checkbox no longer springs back on a recurring tick (ADR-0037's
"recurring complete does not close the row" no longer holds). The success pill
now names where the series went next: `Done · Next due in 7d`.

No migration. Every column the successor needs already exists on `tasks`.
