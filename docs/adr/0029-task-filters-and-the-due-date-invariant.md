# The docket grows filters, and a time implies a date

Date: 2026-07-27

## Context

`/tasks` had no filter UI. The header computed `inboxCount`, `overdueCount`,
and `dueTodayCount` and rendered them as *counts* — three numbers you could
read but not act on. The reference implementation (jerad-ops) has filters on
this page; nothing in this repo's docs or ADRs had ever specified them, so this
is greenfield rather than a port.

Separately, the owner asked for a way to strip a task's schedule entirely, and
asked whether a task can have a time without a date. It can. `tasks.due_date`
(`date`) and `tasks.due_time` (`time`) are two independent nullable columns
with no constraint coupling them and nothing in the Zod layer relating them.
Nothing in the app produces that state deliberately, and a query against the
live database found zero rows in it — but nothing prevented it either, and the
downstream code has quietly assumed the invariant all along:
`lib/reminders.ts` keys the reminder on `due_date` and falls back to the global
anchor time when `due_time` is null, so a timed task with no date would carry a
time that no code path could ever fire.

Recurrence needed checking before constraining anything. Three facts held:

- `completeTask` rolls **only** `due_date`; `due_time` is never touched, so a
  recurring "daily at 09:00" keeps 09:00 across every roll.
- `nextDueDate` accepts `currentDue: null` and starts from today, so a
  recurring task with no due date is already legal, and completing it
  materializes one.
- Reminders already require a date, so a dateless task simply gets no reminder.

None of these conflict with coupling time to date.

## Decision 1 — `due_time is null or due_date is not null`

Enforced in three places, for three different reasons. A DB `CHECK` so the
state is unreachable regardless of who writes. A `.refine()` on
`CreateTaskSchema` so the error arrives at the form rather than as a constraint
violation. And a coercion in `updateTask`, because `UpdateTaskSchema` is
`.partial()` — a patch that nulls only `due_date` is individually valid and
must be judged against the *merged* row. That last case coerces rather than
rejects: clearing a date nulls the time in the same update, which is what
someone clearing a date means.

The migration nulls offending rows before adding the constraint. That is a
no-op against today's data and stays anyway, because a migration that only
works on one snapshot of the database is not a migration.

**Not decided:** recurrence does *not* imply a due date. An unanchored repeat
stays legal — `nextDueDate` handles it, and forcing an anchor would break the
"repeats, starting whenever I first finish it" case for no benefit.

## Decision 2 — Reset clears the whole schedule, recurrence included

The Due row gains a fourth chip beside Today / Tomorrow / +1 week. It is
rendered separately from those three and styled subordinate to them, because it
is an action rather than a relative day.

It clears `due_date`, `due_time`, **and** `recurrence_rule`. The owner chose
this over clearing only the dates: "no dates at all" on a repeating task is
otherwise a lie, since the next completion re-anchors from today and a date
reappears. One button, one meaning.

This required lifting `recurrence_rule` into component state — it had been an
uncontrolled `defaultValue` select while the date and time were already
controlled. No confirmation dialog: the chip mutates form state only, so
re-picking a repeat before submitting undoes it.

## Decision 3 — filters are server-seeded, then client-owned

Status (`Open | Done | Overdue`, default Open), Project, and Domain. Status is
exclusive; Project and Domain AND together.

The server reads the initial filter from `searchParams`, so `/tasks?project=<id>`
deep-links from a project page. Every change after that is client state with
`history.replaceState`. Filtering server-side would have meant a round trip per
filter change — precisely the latency ADR-0028 was written to remove — and the
data is already fully loaded in the client component. Overdue reuses the
existing `isOverdue` predicate rather than growing a second definition of the
word.

Both the Project and Domain dropdowns carry an explicit null option ("No
project" / "Unfiled") behind an `UNFILED` sentinel, kept distinct from `""`
meaning "no narrow". ADR-0027 made an unfiled task one with `domain_id: null`
rather than a pseudo-domain row, so without the sentinel the unfiled queue —
the thing `/inbox` exists to drain — would be the one view the filters could
not reach.

`listRecentDone`'s limit goes from 10 to 100 so the Done filter has something to
show. Still one query.

## Consequences

- A task can no longer carry a time that nothing will ever fire.
- Clearing a date silently clears the time. This is intentional and is the only
  place in the app where one field's edit nulls another; it is defensible
  because the pair is one concept.
- The project page can now link into a filtered docket, which is the answer to
  "see the list of tasks per project" without building a second task list.
- Filters are not persisted between visits. If that turns out to be wanted, the
  URL already carries the state and a cookie would be a small addition.
