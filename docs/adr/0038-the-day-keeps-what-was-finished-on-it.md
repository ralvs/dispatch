# The day keeps what was finished on it

Date: 2026-08-03

## Context

Today's day bands were built from open tasks only —
`loadDayScheduleInputs` read `listTasks(sb, { status: "open" })`, and the
client projection in `day-bands.tsx` dropped any row whose optimistic status
had turned `done`. Ticking a checkbox therefore deleted the row from the page.

That is defensible for a queue and wrong for a day. Two things break:

- **The record of the day is destroyed by using it.** A task due at 09:00 and
  finished at 09:05 leaves no trace on the timeline it was standing on. Reading
  Today at 18:00 says nothing happened before 18:00.
- **The completion has no confirmation.** A row vanishing is the same gesture
  as a row being deleted or filtered out. There is no way, from the page
  itself, to tell a task that was completed from one that was never there —
  which also means no way to notice and undo a mis-tap.

The Top 3 band made this sharper: `slotsOpen` counts down from three, so
finishing a starred task re-opened its slot and invited a fourth star. The
shortlist reported capacity that the day had already spent.

## Decision

**The day bands show the day, not the backlog.** A task completed on the day
being read stays in the band it occupied, struck through, with its checkbox
checked.

Three rules follow:

1. **Membership is by placement, not by status.** `buildDaySchedule` takes
   `completedTasks` alongside `openTasks` and runs both through the same
   placement rules. Nothing is added that was not already on the day: a
   completed task still has to be due by `dateIso` or starred for it. A task
   with no due date, finished today, never appears — it was never on the day
   to begin with.

2. **Scoping is by `completed_at`, not by due date.** `listCompletedOn` reads
   the app-timezone day window (`dayWindowUtc`). An overdue task closed today
   is today's work and shows on today; the same task on tomorrow's page is
   gone. This is the only way the overdue case can work at all — its due date
   points at a different day than the one it was finished on.

3. **Completion is kept out of every count.** `loadDayScheduleInputs` returns
   `completed` as a separate array from `open`. Overdue, due-today, inbox, the
   anchor sentence, and the cadence lines all still read `open` alone. "How
   much is left" and "what happened today" are different questions and must not
   share an input.

The optimistic layer mirrors this with `applyDayTaskList`, which patches a row
in place rather than moving it between lists. It deliberately does **not**
clear `top3_for_date` on completion the way `applyTaskLists` does — the server
never writes that, so clearing it client-side would flash a starred row out of
Top 3 and straight back in on the next RSC render.

## Consequences

- Completing a task on Today is now visually a state change rather than a
  removal, and is reversible from the same row.
- A completed starred task keeps occupying its Top 3 slot for the rest of the
  day. `slotsOpen` reports what is actually left of the day's shortlist.
- Done rows sit below the open ones in the Open band and are exempt from
  `OPEN_CAP`. The cap exists to stop a backlog of *work* from swamping the
  band; capping the merged list would let the morning's completions push live
  work off the page.
- **A recurring task still leaves the day when completed.** It rolls to its
  next due date and stays `open` (docs/adr/0037), so it is genuinely no longer
  this day's work. `projectSchedule` detects this by the `due_date` moving, not
  by status.
- One extra indexed query per day-schedule read (`completed_at` window,
  `status = done`). It joins the existing `Promise.all` in
  `loadDayScheduleInputs`, so it costs no round-trip.
- Past days now read as history: navigating back shows what was finished then,
  not only what is still outstanding from then.
