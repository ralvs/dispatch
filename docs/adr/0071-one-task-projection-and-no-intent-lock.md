# One task projection, and no intent lock

Date: 2026-10-02

What a task intent does to a row was written four times on the client:
`applyTaskLists` and `applyDayTaskList` in `lib/task-interaction/apply-intent.ts`,
`applyDayIntent` in `lib/day-schedule.ts`, and `afterIntent` in the store's task
adapter. They copied each other ("`DONE_CAP` mirrors `applyTaskLists`"), and the
task adapter had no `project` hook, so a tick then an untick before either
answered left Today's open count one low until the next seed.

## Supersedes

- ADR-0037 decision 5 ("client locks are scoped to intents whose replay is
  destructive") and its "Why both halves" paragraph. The old ADR is left as
  written.

## Decision

1. **`projectTask` is the one per-row rule** (`lib/task-interaction/apply-intent.ts`).
   It returns the row after an intent, `undefined` for a delete, and the same
   reference when nothing changes — a complete on a row that is not open
   included, like the server's `status = open` guard.
2. **The task adapter owns placement** (`lib/store/kinds/task.ts`): the /tasks
   lists, a scoped list, and a day's bands. `lib/day-schedule.ts` only places.
   The adapter's `project` hook is `projectTask`, so every count is taken from
   the row as the user sees it, pending intents folded on. A pending delete
   leaves no row, so a second delete or a tick after it counts nothing.
   `KindAdapter.project` now receives the pending intent's own `ctx`, and may
   return `undefined`.
3. **The day keeps its overflow.** `placeOnDay` returns the open tasks past the
   band's cap in `overflow`. They are never shown; a re-placement in the browser
   uses them to backfill the band when one of the ten leaves it.
4. **The intent lock is gone** (`lib/task-interaction/intent-lock.ts`). It was
   there because a recurring complete rolled the row's due date forward, so the
   checkbox sprang back and a second click rolled it again. Since ADR-0059 a
   complete closes the row: the checkbox stays ticked, so a second click is a
   reopen, and a replayed complete finds a closed row on both sides — the
   server writes nothing and `projectTask` changes nothing.

## Consequences

- One task intent is tested in two places: `projectTask` alone, and the store
  (`lib/store/kinds/task.test.ts`) for lists, bands and counts, including
  intents applied before the server answers.
- A double click that lands before the row re-renders sends two completes. The
  second writes nothing; it can show a second "Done" toast.
- A completion the server refused, followed by an untick before it answered,
  can leave the open count one high until the next seed. Nothing in the
  reopen's answer says the complete never happened.
