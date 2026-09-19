# Capture vocabulary growth — scope and ambiguity handling

Date: 2026-07-20

> **Partial supersession (2026-07-20).** Decision 2 (audio capture +
> transcription failure path) is **superseded by
> [ADR-0017](./0017-no-in-app-audio-transcription.md)** — Dispatch does not
> transcribe audio. Decision 1 and the vocabulary table below still stand.
>
> **Update (2026-09-19).** `match.ts` has landed for task routing (projects
> and domains) — see [ADR-0061](./0061-the-parser-request-follows-the-reference.md).

## Context

ADR-0008 deferred `complete_task`, the entity-resolution verbs, the
project/person executors, and a `needs_disambiguation` flow (audio
transcription was also deferred then; it is now cut — ADR-0017). This ADR
researches the reference implementation (`ralvs/jerad-ops`, private) for how
it solved the same problems, records where Dispatch follows it and where it
deliberately doesn't, and locks the vocabulary scope for the execution plan
(`docs/capture-vocabulary-2026-07-20.md`).

The reference resolves `*_match` fuzzy phrases ("the Reviews plugin",
"Randy") server-side against context the parser was given, via
substring/word-overlap scoring (`apps/api/src/lib/match.ts`, threshold 0.5).
The parser itself decides, from context it's handed, whether a phrase is
confident enough to name a match or genuinely ambiguous. That much transfers
directly. Two things about the reference's design do not.

## Decision 1 — ambiguous matches fold into `needs_review`, no candidate picker

**The reference's own shipped UI never renders its disambiguation
candidates.** `ParsedActionSchema` has a top-level `needs_disambiguation`
shape (`{ needs_disambiguation: true, field, candidates: [{id, label}] }`),
and the API round-trips it — but
`apps/web/src/components/TextCapturePalette.tsx` shows exactly one string for
it: *"Ambiguous: `<field>`. Try again with a more specific name."* The
candidates array reaches the client and is never displayed or made
selectable. The picker the shape implies was never built.

Dispatch already has a mechanism for "the parser can't confidently place
this": the `needs_review` action, landed in v1
(`lib/schemas/capture.ts`), which degrades to a note via the same path every
other capture failure uses. Given the reference's own UI doesn't act on its
richer shape, building one here would add a new top-level parser response,
new capture-machine states, and a new palette UI for a case that should be
rare if the parser's context is good — surface with no shipped precedent to
justify it.

**Decision:** an ambiguous entity reference is instructed to become
`needs_review` — same verb, same executor path, same note. The parser's
system prompt gains a rule: when a `*_match` phrase could plausibly resolve
to two or more entities it was given in context, emit `needs_review` with
`reason` naming what it saw (e.g. `"'the review task' could be 'Review Q3
numbers' or 'Review PR #142' — both open"`) instead of guessing. Resolution
is manual: reopen the note at `/notes`, or recapture with a more specific
phrase. No new response shape, no candidate-picker UI.

**Revisit when** ambiguous captures turn out to be frequent enough that
manual resolution is the actual daily friction — not before. A picker is a
straightforward addition on top of this (the parser already has the
candidate list in context; only the UI and one more machine state are new).

## Decision 2 — ~~audio capture~~ **SUPERSEDED by ADR-0017**

Originally: audio capture would persist a recording before transcribing, and
a failed transcription would degrade to a note pointing at the audio. That
path is cancelled — see ADR-0017. Kept only as historical record of the
question that was asked.

## Vocabulary scope — what ships, what doesn't

The reference's full `VoiceActionSchema` has 14 variants. Dispatch's
growth path (ADR-0008: *"add a service, add its executor case, add a
variant"*) only extends to what already has a service with no rewrite
needed — exactly how `create_quote`/`create_journal_entry` landed.

| Reference verb | Ships now | Why |
|---|---|---|
| `complete_task` | Yes | `completeTask(sb, id, todayIso)` exists; needs only `matchTask` |
| `create_project` | Yes | `createProject` exists |
| `update_project_status` | Yes | `updateProject`/`completeProject`/`archiveProject` all exist |
| `create_person_fact` | Yes | `createFact` exists; skips (degrades) if the person doesn't resolve — this verb never creates a new person |
| `log_activity` | No | `activity_log` table exists in the DB but has **no service layer** in Dispatch yet — this is a new service, not a growth-path wire-in. Out of scope for this plan. |
| `update_milestone` | No | `toggleMilestone`/`matchMilestone` are cheap to port but need double resolution (project, then milestone scoped to it) — P2 stretch, not core. |
| `create_calendar_event` | No | Dispatch creates calendar events through `createEventHere` (CalDAV push, ADR-0006) — a different, already-decided path. Not a capture verb here. |
| `create_quote_annotation`, `set_resurface_weight`, `update_content_item`, `add_inventory_item` | No | Annotation/resurfacing UI doesn't exist yet; content pipeline (ADR-0007) and inventory were cut. |

`create_person` (making a brand-new contact by voice) is **not** in the
reference vocabulary either — facts only attach to people who already exist.
Dispatch keeps that constraint.

## Consequences

- `lib/services/capture/match.ts` — new pure-scored fuzzy-match module,
  ported from the reference's `match.ts` algorithm (substring/word-overlap,
  0.5 threshold), unit-testable with no database.
- `lib/schemas/capture.ts` gains `complete_task`, `create_project`,
  `update_project_status`, `create_person_fact` variants; `needs_review`'s
  `reason` field is where ambiguity now surfaces — no schema change there.
- The parser gains a context block (open tasks, active projects, domains,
  recently-interacted people) so it has something to fuzzy-match against and
  decide ambiguity from — same shape as `lib/ai/chat-context.ts`, capped the
  same way.
- Full breakdown, files, and acceptance criteria:
  `docs/capture-vocabulary-2026-07-20.md` (audio items 6–8 cancelled per
  ADR-0017).
