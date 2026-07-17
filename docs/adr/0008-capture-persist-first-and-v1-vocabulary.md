# Capture persists first; parser v1 speaks a two-verb + needs_review vocabulary

The capture module is one deep function, `capture(sb, raw) → CapturedRecord`
(`lib/services/capture/`). It **persists the raw input to `captured_data`
first**, then transcribes/parses/executes internally. The raw insert is the
only step allowed to throw; every internal seam returns a typed fallback and
degrades failure to a `needs_review` note rather than dropping input (iron
rule #4).

## Persist-first choreography

`captured_data.processed_status` runs `raw → parsed → displayed → archived`.
Capture owns only `raw → parsed`; `displayed`/`archived` belong to the feed
read-layer.

1. **Insert `raw`** (source `manual`, type `voice_capture`, transcript + `via`
   verbatim in `payload`) — the durability point and the **sole throw**. If it
   fails nothing was captured; the palette keeps the text to retry.
2. Everything after the raw insert runs inside **one no-throw boundary** (a
   single `try/catch` in `capture()`), not per-seam discipline: config/env
   validation, date-context resolution, parse, execute, and `markParsed`. Any
   throw is caught and best-effort degraded to a linked `needs_review` note.
3. **Execute** actions with per-action isolation (never throws).
4. **`markParsed`** (raw → parsed) — best-effort; internally swallows a rejected
   request or an error result, so a failure leaves the row `raw` for the sweep
   without tripping the boundary.

**Once the raw row exists, `capture()` never rejects.** If even the fallback
note write fails, it resolves with a `recorded_only` outcome (status stays
`raw`) and the row is left for the reconciliation sweep — the caller always gets
a representable receipt. `CapturedRecord.outcome` is therefore one of
`executed` | `needs_review` | `recorded_only`; the degrade reason
`capture_error` marks a note produced by the boundary (as opposed to a typed
parser failure).

### Raw-orphan invariant and the reconciliation sweep

Any row stuck at `processed_status = 'raw'` past a threshold (~10 min) is an
orphan — the pipeline crashed before terminating. The future sweep (a cron,
deferred) **degrades orphans to a `needs_review` note and marks them `parsed`;
it does not replay the pipeline.** Replay would re-run non-idempotent executes
(a second `createTask`); v1 has no per-action idempotency keys, so
degrade-not-replay is the safe never-lose choice. The sweep dedupes on
`notes.origin_capture_id` (migration 0004): if a note already links to the
capture, it skips it.

**Known gap (accepted, documented — same class as `recordedAction`'s):** a
crash in the window between execute and `markParsed` leaves actions done and
the row `raw`; the sweep then makes a *duplicate `needs_review` note* (never a
duplicate task). Rare, low-harm, single-user.

## v1 vocabulary supersedes the `voice.ts` draft

Only the tasks and notes services existed at the time, so v1
(`lib/schemas/capture.ts`) emitted three verbs, replacing the 15-variant
`VoiceActionSchema` draft (deleted):

- `create_task` — `{ title, due_date?, due_time?, priority? }`
- `create_note` — `{ body, source_type?, tags? }`
- `needs_review` — `{ reason, proposed_kind? }`: the parser flags content that
  references an entity it cannot resolve (a project, person) instead of
  guessing; the executor turns it into a `needs_review` note.

Since landed (executor + variant added, no rewrite needed): `create_quote`,
`create_journal_entry`, `log_health_metric` — see
`lib/services/capture/executor.ts`.

Unknown/unsupported verbs the model might emit are **not** in the schema, so
they fail `CaptureActionsSchema` during parsing (→ typed `failed` → degrade),
never a runtime error in the executor. Parser fallbacks are `unavailable`
(gateway unconfigured), `failed` (call threw / invalid output), and `empty`
(nothing actionable → the raw text is preserved as a plain note,
`needs_review = false`).

**Growth path to the full reference vocabulary:** add a service, add its
executor case, add a variant here. The reference vocabulary (projects,
people, inventory, milestones, calendar, resurface-weight) is the roadmap;
the reference impl stays linked in `CLAUDE.md`. No rewrite needed — quotes,
journal entries, and health metrics landed exactly this way.

## Ledger applies at ingest, not at the palette

The palette is **user-initiated** — the owner watches their capture land — so
it writes no `notifications` row. Iron rule #6 is for autonomous/external
actions. **External ingest is deferred entirely** (`INGEST_WEBHOOK_SECRET`
lives in Phase 7): no `/api/ingest`, no `secret-auth`, no audio/ingest
`CaptureInput` variants in v1.

Decided future shape for ingest: it wraps capture via an **atomic RPC** that
inserts the `captured_data` row and the `notifications` row in one Postgres
transaction, **idempotency-keyed on `source_ref`**. Rule #6 must not be
droppable for external actions via a post-hoc `LedgerError` (the gap
`recordedAction` documents), which is why ingest gets a transaction rather than
the two-call seam the palette path does not even need.

## Bilingual verbatim

Content is stored verbatim in the language spoken (PT-BR or EN), never
translated (ADR-0004). Enforced twice: the parser prompt instructs verbatim
copy of every free-text field, and — structurally — every degrade path stores
the raw transcript with no model in the loop, so verbatim holds even when the
parser is unavailable or wrong.

## Deferred

Audio transcription (palette sends text; transcriber is a stub returning
`unavailable`); `complete_task` and every entity-resolution verb; the
project/person/inventory executors (quote/journal/health landed — see above);
the `needs_disambiguation` flow; the reconciliation sweep cron (invariant
fixed here); external ingest and its atomic RPC.

## Why

The never-lose rule was enforced by discipline only: the draft schema pointed
at an executor that did not exist and the degradation target had no write path.
Persisting the raw row before any AI call turns "never lose a capture" into a
structural property — the durable write happens before anything that can fail.
Narrowing the vocabulary to what the services can fulfil keeps the executor
honest (unsupported intents degrade visibly instead of silently doing nothing),
while the deleted draft's ambition is preserved as an explicit roadmap.
