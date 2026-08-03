# Writes are preconditioned, not read-modify-write

Date: 2026-08-03

Prompted by a claim about `useOptimistic` under rapid clicks. The claim turned
out to be false for this stack; checking it surfaced a real bug underneath.

## Context

The claim under test: `useOptimistic` + `startTransition` + Server Actions lets
a rapid five-click fire five *overlapping* requests that land at the database
out of order, and the fix is a per-item `disabled={pendingId === id}` lock.

**The premise does not hold on Next 16.** Read from the installed 16.2.10
source:

- `client/app-call-server.js` — `callServer` doesn't fetch. It wraps a promise
  and dispatches `ACTION_SERVER_ACTION` into the app-router action queue.
- `client/components/app-router-instance.js:104-161` — `dispatchAction`: when
  `actionQueue.pending !== null` and the payload is not `NAVIGATE`/`RESTORE`,
  the action is appended to a linked list and **not started**. Only
  `runRemainingActions` (`:49-68`) starts it, after the previous action settles.
- `router-reducer/reducers/server-action-reducer.js:42` — the fetch lives
  inside the reducer the queue awaits.

So N rapid clicks are N **sequential** POSTs from one tab. There is no
interleaving, and the prescribed blanket lock buys nothing. For the star it is
actively wrong: tap-star, change-mind, tap-again must both land.

**What is real is worse, because it is invisible.** Completing a recurring task
does not close it — `completeTask` rolls `due_date` forward and leaves the row
`open` (`lib/services/tasks.ts`). The checkbox springs back to unchecked, the
action discarded the `{ rolled: true }` it got back, so nothing told the user
what happened and the natural response was to click again. Each click advanced
the due date another whole interval. Five fast clicks moved a weekly task five
weeks out.

The reason no one caught it: the optimistic reducer
(`lib/task-interaction/apply-intent.ts`) runs the *same* roll math as the
service. Client and server agree at every step. The corruption is
silent-by-agreement — invisible to any check that compares optimistic state
against what came back.

Two supporting findings. `toggleTop3` and `togglePin` SELECTed the current
value, negated it in JS and wrote it back — consistent under serialization, a
lost update across a phone and a desktop. And no write in the repo carried a
precondition at all: every `.update()` was filtered by `.eq("id", id)` alone,
with no `.rpc()` and no version column anywhere.

## Decision

1. **A write that derives its new value from the row's current value must carry
   a precondition on the value it observed, or be re-expressed as a
   desired-state setter.** `completeTask` takes the due date the clicked row was
   showing and adds it to the UPDATE. Nullable preconditions use `is`, never
   `eq` — `= NULL` matches nothing in Postgres, and a recurring task may
   legitimately have no due date.
2. **Desired state is preferred to a flip.** `setCompletion`
   (`lib/services/routines.ts`) was already the model; `setTop3` and `setPin`
   join it. The caller says where the row should end up, derived from what is on
   screen — the same comparison the optimistic reducer makes.
3. **A failed precondition returns `{ applied: false }`, never throws.** It is a
   no-op, not an error. Throwing would toast and revert an optimistic state that
   semantically means "already done", or that belongs to a row someone deleted.
4. **`revalidatePath` runs even on `applied: false`.** ADR-0035 Decision 3
   ("only act when rows moved") is hereby scoped to `afterExternalMutation` —
   cron and API paths, which have no optimistic transition on the other end.
   Server Actions always revalidate: the transition is waiting for an RSC
   payload to settle into, and skipping it strands the row on stale props.
5. **Client locks are scoped to intents whose replay is destructive.**
   `lib/task-interaction/intent-lock.ts` covers exactly one: `complete`.
   Explicitly rejected — a global per-item pending lock, `disabled` on toggle
   controls, and any use of the `useTransition` pending flag on these surfaces.
   All buy round-trips, not correctness, and Decision 0 above is why.

**Why both halves.** Neither is sufficient alone. The precondition does not fix
the in-tab repeat click, because the optimistic reducer advances the observed
due date in lock-step with the server, so the guard passes on every click. The
lock does not fix a stale second tab, which never claimed anything.

## Consequences

- Rapid-clicking a recurring task's checkbox now rolls it exactly one interval.
  The second and later clicks are dropped at the lock; a click arriving from a
  stale render is dropped at the precondition.
- A replayed close of a non-recurring task no longer rewrites `completed_at`,
  so it cannot reshuffle the "Recently done" strip.
- Star and pin each lose their read — one round-trip instead of two.
- Unstarring while reading tomorrow can no longer clear today's star, which was
  reachable through Today's day navigation (ADR-0036).
- Re-pinning an already-pinned note preserves pin order instead of silently
  unpinning it.
- The optimistic reducer stays deliberately non-idempotent, with a
  characterization test saying so. Early completion of a not-yet-due recurring
  task must still roll (`nextDueDate` starts from `max(currentDue, today)`), so
  a "only roll if `due_date <= todayIso`" rule would silently break it. Replay
  is stopped a layer up instead. That test is the reason the lock exists.
- No `version`/`updated_at` column, no `.rpc()`, no migration. Every guard here
  is expressible in the existing PostgREST filter surface.
- **Known edge, accepted.** A desired-state setter reads its boolean from the
  render closure, so two clicks landing inside one render would both send the
  same value where the old flip sent two flips. Not reachable with a mouse:
  measured against the dev server, a rapid double-click on the star produced
  one landed click, because the button's DOM node is replaced by the optimistic
  re-render between mousedown and mouseup. Only synchronous scripted clicks hit
  it, and the result is still a state the user asked for, reconciled by the next
  RSC payload — no corruption, unlike the case this ADR exists to close.
- No test can drive Next's action queue, which is why the file:line evidence
  above is recorded here rather than asserted somewhere. If a future Next
  release stops serializing action dispatches, Decision 5's scoping is the part
  that needs revisiting — the preconditions hold either way.
- **Still read-modify-write, knowingly.** `setDomainCadence`
  (`lib/services/domains.ts`) SELECTs a JSON column, merges and overwrites, and
  its caller (`app/(authed)/settings/actions.ts`) runs that as a second
  unsynchronized statement after `updateDomain`. Left alone: the UI guards it
  with `disabled={pending}`, and the fix wants a single JSONB merge statement,
  which is its own change. Same for `toggleCompletionAction`
  (`app/(authed)/routines/actions.ts`), which negates a `currentlyDone` boolean
  supplied by the browser — `setCompletion` is idempotent given that boolean, so
  the exposure is cross-tab only.
