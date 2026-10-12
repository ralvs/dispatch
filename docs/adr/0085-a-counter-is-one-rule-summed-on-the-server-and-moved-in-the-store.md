# A counter is one rule, summed on the server and moved in the store

Date: 2026-10-12

Today's counters were counted in more than one place. Open, overdue and
inbox were counted in `assembleTodayView` and again in the task kind's
`countsOf`. A project's done count had three sources, and /projects never
seeded `project.open`. A domain's open count was counted in the neglect
sweep's reader and moved by nothing, so a tick left /domains stale. The
review count had two server sources, and "routines done today" had two.
Each pair could drift, and nothing checked that they agreed.

`lib/quiet.ts` (docs/adr/0058) already settled this shape for one rule: a
pure, client-safe function the server and the store both ask. This extends
it to every counter.

## Decision

1. **What a row adds to each counter is one pure rule.** `lib/counts.ts`
   names the counters (`CounterKey`) and, per family, what one row adds:
   `openWorkCounts` (tasks.open, tasks.overdue, tasks.inbox,
   `domain.open:<id>`), `projectCounts` (`project.open:<id>`,
   `project.done:<id>`), `noteCounts` (notes.needsReview) and
   `isRoutineDoneOn`. A row adds to a counter or it does not; there is no
   second rule anywhere.
2. **The server sums it; the store takes its difference.** A server reader
   counts with `tally(rows, rule)`. A store adapter's `deltas` is
   `change(rule(before), rule(after))`. `AggregateKey` is `CounterKey` plus
   the two counters no row rule owns (`notifications.unread`,
   `events.today`).
3. **Every surface that shows a counter seeds it.** A counter moves only once
   seeded. Today, /projects and a new project seed both project keys through
   `projectCounters`. /domains seeds `domain.open:<id>` with the quiet
   projects that left tasks out of it, and a new domain seeds it at zero.
4. **A count the page cannot sum is the rule's filter form.** Today does not
   read the notes, so its review count stays a head count in SQL
   (`countNeedsReview`), as `notQuietFilter` is `isQuiet`.
   `notes.int.test.ts` holds the two to the same answer.
5. **Routines done today is never an aggregate.** The routines view holds
   every routine with its completions, so both Today's summary and the card
   count it from the rows through `isRoutineDoneOn`.

## Consequences

- A new counter is a key and a rule in `lib/counts.ts`, a seed on each page
  that shows it, and an adapter that already takes the difference.
- A filed or ticked task now moves its domain's open count wherever the store
  holds it.
- `countTasksByProject` still reads every tagged task without a range. Past
  PostgREST's max rows it would undercount; that is unchanged here.
