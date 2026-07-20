# External write paths keep a best-effort ledger, not an atomic RPC

Date: 2026-07-19

## Context

ADR-0008 deferred external ingest and sketched the shape it should take when
it arrived: wrap capture in an **atomic RPC** inserting the `captured_data`
row and the `notifications` row in one Postgres transaction, **idempotency-keyed
on `source_ref`**, so iron rule #6 could not be dropped by a post-hoc failure.

That shape was never built, and has now been passed over twice:

- Phase 7 shipped `POST /api/ingest` as a two-call seam — `capture(sb, …)`,
  then `recordNotification` inside a `try/catch` that swallows the failure.
- The 2026-07-19 ops-shell work (ADR-0014) added `POST /api/links` the same
  way, deliberately matching the endpoint next to it.

Nothing in the codebase calls `.rpc(`. An ADR that describes a design two
shipped endpoints ignore is worse than no ADR: the next agent reads it as the
contract and either "fixes" working code or quietly deviates a third time.

## Decision

**Keep the two-call seam.** External write paths commit the durable record
first, then write the ledger row best-effort. A failed ledger write is
swallowed, never surfaced to the caller, and never rolls back the record.

The ordering is the part that matters and it stays: the thing the owner would
mourn — the capture, the link — is committed before anything that can fail.
That is iron rule #4, and it holds independently of the ledger.

Iron rule #6 stays a rule about *intent*: every autonomous or external action
routes its ledger row through `recordNotification`. It is the blessed path,
not a proof of impossibility — which is what `lib/services/notifications.ts`
has said in its "Known limits" since it was written.

## Why not the RPC

- The ledger is a **record for a human**, not an input to a control. Nothing
  reads `notifications` to decide whether work already happened; the unread
  badge and the list are its only consumers.
- An RPC puts the capture contract in **two places** — the service layer and a
  SQL function versioned through migrations — for a single-owner app where
  both endpoints are triggered by hand from one phone.
- Push delivery inside `recordNotification` is already best-effort for exactly
  this reason (a dead subscription must not fail a capture). A transaction
  around the insert would buy atomicity for the row while the delivery it
  exists to trigger stayed lossy.

## Consequences

- **A crash between the durable insert and the ledger write loses the
  notification row, silently.** The capture or link survives and is visible in
  the app. If this ever needs reconciling, it is a query — `captured_data` /
  `ingest_links` rows whose id appears in no `notifications.source_ref`.
- **No idempotency key.** A retried share-sheet post creates a second row.
  Both endpoints are hand-triggered from one device, so a duplicate is visible
  and dismissible at `/ingest` or in triage rather than corrupting anything.
- New external surfaces should copy this seam, not invent a third pattern.

**Revisit when** a sender that retries on its own schedule starts posting (a
third-party automation, a queue), or when something automated begins reading
the ledger to decide whether an action already ran. Both turn a duplicate from
a visible nuisance into a correctness problem, and both make the RPC worth its
cost.

## Supersedes

The "Decided future shape for ingest" paragraph in
[ADR-0008](./0008-capture-persist-first-and-v1-vocabulary.md). Everything else
in ADR-0008 — persist-first ordering, the v1 vocabulary, degradation to
`needs_review` — stands unchanged.
