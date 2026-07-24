# Task reminders fire from a cron sweep, global config, due-date dedupe

Date: 2026-07-24

## Context

Tasks have due dates and due times but nothing ever pinged the owner ahead of
one. The DB already carries the shape for this: `app_settings` gained
`reminder_offset_minutes` and `reminder_anchor_time` (a migration applied
ahead of this ADR), and `tasks.reminders_sent` (jsonb) existed unused.
`tasks.reminder_offsets` also exists — a leftover from an earlier per-task
design — and stays unused; see "What we didn't build" below.

## Decision

**Reminders are configured once, globally — never per task.** One offset and
one anchor time in `app_settings` apply to every dated task. A per-task
override was the more obvious shape but a settings toggle with 8 fixed
choices is enough for a single-owner app, and it means every open task with a
due date gets a reminder without the owner having to opt each one in.

**Offset is whole minutes before the due instant.** `0` (the default) fires
at the due time itself. Choices are `0, 5, 10, 15, 30, 60, 120, 1440`.

**Anchor rule for resolving the due instant:**
- `due_date` + a valid `due_time` → that wall clock, in the app timezone.
- `due_date` only → `reminder_anchor_time` (also global).
- No `due_date` → the task never fires a reminder, full stop.

**Dedupe is keyed on due_date, not on offset or a timestamp.**
`reminders_sent` stores `{"due": "<due_date already handled>"}`. A reminder
is eligible iff `reminders_sent.due !== task.due_date`. This buys two things
for free:
- A recurring task's roll (`completeTask` in `lib/services/tasks.ts` bumps
  `due_date` and nothing else) automatically re-arms the next occurrence —
  `completeTask` never has to know reminders exist.
- Changing the global offset or anchor time never mass-re-fires the backlog
  of already-sent reminders, because neither value is part of the dedupe key.

**Catch-up window: 2 hours.** A reminder whose fire instant is more than 2h
in the past when the cron finally sees it is marked sent **without**
delivering — it must still write `reminders_sent`, not just skip, or every
future tick re-evaluates the same stale row forever.

**Ordering: notify, then mark sent — per task, inside the loop.** Same
choice as ADR-0015: duplicate over loss. A crash between the two calls
means a task can fire twice, never zero times.

**One `reminder.fired` ledger row per delivered reminder. No summary row.**
Each delivery already satisfies iron rule #6 on its own; a per-tick summary
on top would double-count the same event. This is a deliberate divergence
from the sweep cron's shape (which only has an aggregate outcome to report,
so it writes one summary row per acting tick) — called out in both this ADR
and the reminders cron route's header comment.

**Cap 20 reminders per tick, oldest `fireAt` first.** The remainder rolls to
the next tick untouched — no marker written, so it's still eligible next
time.

**No new env var.** Reuses `CRON_SECRET`, same as the sweep cron.

**No new index.** `idx_tasks_status_due on tasks(status, due_date)` already
covers `listReminderCandidates`'s `status = 'open' AND due_date BETWEEN …`.

## What we didn't build

`tasks.reminder_offsets` (jsonb, per-task) is **intentionally dead**. It
predates the global-config decision above. Nothing in this feature reads or
writes it. It stays in the schema rather than getting a migration to drop it
— removing an unused nullable column is lower priority than shipping the
feature it was meant to support.

## Consequences

- **Manual ops step**: register a cron-job.org job hitting `/api/cron/reminders`
  every 5 minutes, `Authorization: Bearer $CRON_SECRET`. Both `GET` and
  `POST` are wired (cron-job.org defaults to `GET`).
- **Known edge**: changing only `due_time` on a task that keeps the same
  `due_date` does **not** re-arm an already-sent reminder — dedupe only
  looks at `due_date`. Move the date (even by re-saving it) or wait for the
  next due_date to get a fresh reminder.
- **Known risk**: every dated open task now pings once by default (offset
  `0`). If that's too noisy in practice, the escape hatch is a digest
  (roll every fire-eligible task for the day into one morning notification)
  rather than turning reminders off per task — that would reopen the
  per-task-config door this ADR closed.
