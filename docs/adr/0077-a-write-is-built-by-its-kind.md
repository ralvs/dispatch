# A write is built by its kind: intent and server call together

Date: 2026-10-04

ADR-0069 made every write an intent the store applies and a server call that
confirms it. Each call site built the two by hand, side by side, so nothing
kept them in step. The routine card showed one: it applied a tick for the
day it showed (`clock.todayIso`) and sent no date at all, so the server ticked
its own today. A tab that slept past midnight ticked the wrong day. Failure
toasts also ran down four separate paths (`useRunIntent`, `useStoreWrite`
callers, `useResultAction`, hand-written `try` blocks), each with its own
copy rules.

## Extends

- ADR-0069: writes still update rows, not pages. This fixes how a write is
  built and run.

## Amends

- ADR-0054: `toggleCompletionAction`'s `date` is now required. Its bounds are
  unchanged: a day outside the 30-day window still throws.

## Decision

1. **Each kind has a writes module** — `lib/writes/<kind>.ts` for kinds whose
   actions sit in `lib/actions/`, else `<route>/writes.ts` beside that route's
   `actions.ts` (ADR-0070). A builder per command makes the intent and the
   server call from the same arguments (`write(kind, intent, call, copy)`). A
   writes module imports server-action references only: no services, no
   `server-only`, no `lib/store/server`, never `"use server"`.
2. **The server half receives the ctx the store applied the intent with.** A
   call that needs a day sends `intent.date` or `ctx.todayIso`, so the server
   writes the day the user saw. The server checks that day against its own
   with `acceptedDay` in `lib/dates.ts` (iron rule #1): a real date, not
   after its today, at most N days before it.
3. **One runner, `useWrites`** (`lib/store/run.ts`): `send` (fire and
   forget), `save` (awaited, true once confirmed), `submit` (for
   `useResultAction` forms: the result goes back untouched) and `adopt` (a
   write made outside a server action). `useInlineEdit` wraps `save` for
   inline edit forms.
4. **One failure → toast path, `toastFailure`** (`lib/client/failure.ts`). A
   navigation toasts nothing; a specific form error is shown as is; the
   generic one, a throw, or a failure with nothing else to show takes the
   write's own copy. A form that shows its field errors passes
   `fieldErrorsShown` and gets no toast for them. The runner and
   `useResultAction` both call it.
5. **One read-back, `written(sb, kind, id, opts)`** (`lib/services/written.ts`):
   the row after the write, or its id as deleted. Server-only and takes `sb`
   first (iron rule #3). It must never sit in a `"use server"` file, where it
   would become an endpoint with no owner check (iron rule #2).
6. **End state for forms: the server half takes typed input**, not FormData.
   Until AC-06 makes that switch, a form builder accepts FormData and passes
   it straight to today's action.

## Consequences

- The routine toggle carries its intent's day; the midnight bug is gone.
- A failure result whose `formError` is the generic one now shows the
  write's specific copy, and a form failure with neither a form error nor
  field errors now toasts instead of staying silent.
- `useRunIntent` and `useStoreWrite` stay until every kind has moved, then go.
