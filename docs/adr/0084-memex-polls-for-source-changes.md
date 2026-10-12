# Memex polls for source changes, with no trigger in `public`

Date: 2026-10-12

Memex is the knowledge engine planned inside Dispatch (map #117). It reads
Renan's notes and done tasks (point 4) and compiles them into thoughts
(#120, ADR-0081). It must learn when a source changes: a new note, an edit,
a tick, an un-tick, a delete.

No single place in the app sees every change (#119). Notes and tasks are
written by service functions, by SQL functions (`note_body_append`,
`complete_recurring_task`, and others), by a trigger, and by cascades. Only
the tables see everything. Deletes are hard deletes.

The obvious design is a trigger on `public.notes` and `public.tasks` that
writes each change into a `memex` outbox. This ADR says why Memex does not
do that.

## Decision

1. **Memex polls.** A cron route, run every 15 minutes from cron-job.org
   like the other crons, reads `public.notes` and `public.tasks` and compares
   them with what Memex already read. Memex keeps that state in its own
   schema. There is no trigger, publication or queue on a `public` table.
   The poll code lives in `memex/`. The only file outside it is the route
   file Next.js needs under `app/api/`, which is Memex's entry point and the
   one place allowed to import `memex/`. Dispatch code still never does.
2. **A change is a change in the text Memex reads**, not a new `updated_at`.
   Memex stores a hash of the fields it reads for each source: title and body
   for a note; title, notes, `completed_at`, `due_date`, `due_time` and
   `recurrence_rule` for a task. A pin, a top-3 star or a sent reminder moves
   `updated_at` but not the hash, so it costs nothing.
3. **A note is read when it is quiet.** Memex reads a note only after 10
   minutes with no new `updated_at`, so an autosaving note is read once, not
   on every save. A pin can delay a read by those 10 minutes, but it never
   causes one: the hash decides whether there is anything to read.
4. **Only done tasks are sources** (map #117). Memex reacts to a task
   completed, edited while done, reopened, or deleted. A recurring tick is a
   new done snapshot (ADR-0083); an un-tick deletes it. Open tasks are read
   live when Memex needs them, for example to avoid proposing a task that
   already exists, and they never become thoughts.
5. **Deletes are found by difference.** Memex already links each thought to
   its sources (#120). A linked source that is gone, or a task that is no
   longer done, is a lost source, handled as #120 says. This check comes
   before the hash: a reopened task has a new hash (its `completed_at` is
   cleared), but it is lost, not read again. A source that is gone or no
   longer done also leaves Memex's progress state, so it is never retried.
6. **Each run checks the switch and has a cap.** If Memex is off in
   `app_settings`, the run does nothing. Each run reads at most about 20
   sources, to bound the paid AI calls; the rest wait for the next run.
   Progress is kept per source, so a failed source is tried again and a
   switched-off Memex catches up when it is switched on.

## Why not a trigger

A trigger runs inside Renan's write. A bug in it can fail a capture or a
tick (iron rule 4), unless it swallows every error, and then it hides the
bug. A trigger is also an object on a Dispatch table: a revert must drop it,
and the boundary in map #117 says a revert is "switch off, delete `memex/`,
drop the schema". pg_net, Database Webhooks, Realtime and pgmq all need the
same trigger or a change to a `public` publication (#119). A call from the
services breaks the one-way import rule and misses the SQL functions and
cascades.

Polling keeps all of that true. It costs latency: a change is seen within
about 15 minutes, plus the 10 quiet minutes for a note. For knowledge, and
for a question about a ticked task, that is soon enough.

## Consequences

- Memex never slows or fails a Dispatch write, and a revert leaves nothing
  in `public`.
- Each run scans both tables. At hundreds of notes this is cheap; if it is
  ever slow, an index on `updated_at` or a narrower scan comes first, and a
  trigger stays the last resort.
- A change made and undone between two runs is never seen. That is fine:
  nothing lasting happened.
- The first run sees every existing note and done task as new. Whether that
  is the backfill, and how it is paced, belongs to the migration ticket
  (#125).
