# create_event joins the capture vocabulary

Date: 2026-07-25

## Context

ADR-0008 fixed the v1 vocabulary at the verbs the executor could actually
fulfil — task, note, quote, journal entry — and ADR-0016 set the growth path:
a service, an executor case, a schema variant.

Events were the conspicuous gap. The README has always advertised capture into
"tasks, notes, quotes, journal, people, events", the Today briefing renders a
day schedule from `calendar_events`, and `createEventHere()` has existed since
Phase 7 pushing a VEVENT to the calendar named by `ICLOUD_CALENDAR_NAME`
(ADR-0006's single push target) — with `No UI calls this yet` in its docstring.
Every piece was in place except the verb.

Meanwhile "jantar com o Pedro sexta às 20h" parsed as a *task* with a due time,
which put a checkbox on something you do not tick off, and never reached the
phone that actually alerts you.

## Decision 1 — the model picks the duration

`create_event` requires `end_time`. The schema will not accept an event without
one, and the executor never supplies a default.

The obvious alternative — start + a fixed 60 minutes — is wrong more often than
the model is. A standup is fifteen minutes, a call thirty, lunch an hour, a
flight as stated. The prompt asks for the inference explicitly and the schema
makes it non-optional, so a model that ignores the instruction fails
schema-parse and degrades, rather than silently booking an hour.

`end_date` is optional and only carries an event across midnight.

## Decision 2 — it throws, so the existing degrade catches it

This is the only capture verb whose side effect leaves the building. It can
fail in ways no other verb can: no CalDAV credentials, no calendar by that
name, iCloud unreachable, or an end at or before its start.

Every one of those throws, so `runOne`'s catch turns it into a `needs_review`
note holding the verbatim transcript. No new failure plumbing was added — the
per-action isolation from ADR-0008 already had the right shape, and the words
survive in a form the owner can act on by hand.

The CalDAV client is constructed inside the action, not in `Provenance`, so a
capture with no event verb never opens a connection.

## Decision 3 — wall clock in, UTC stored

The model answers in the app timezone the prompt gave it (`start_date` +
`start_time` as local wall clock). The executor converts through
`instantFromLocal()` before anything is written or transmitted. No date math
lives in the capture path (iron rule #1).

A successful push writes a `capture.event` ledger row (iron rule #6),
best-effort per ADR-0015 — the event is already on the calendar and a failed
notification insert must not suggest otherwise.

## Consequences

- Events created this way are `source='created_here'` and land on the Dispatch
  calendar, so they stay visually distinct in Apple Calendar and the whole
  write path is still reversible by deleting one calendar (ADR-0006).
- With CalDAV unconfigured, every event capture degrades to a review note.
  That is the correct behaviour but it is silent about the cause beyond the
  note's reason string.
- The task/event boundary is a model judgement. The prompt draws it at "the
  time IS the thing" versus "the time is a deadline"; expect to tune it.
