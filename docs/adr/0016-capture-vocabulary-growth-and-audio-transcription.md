# Capture vocabulary growth and audio transcription — scope and two deviations

Date: 2026-07-20

## Context

ADR-0008 deferred five things: audio transcription, `complete_task`, the
entity-resolution verbs, the project/person executors, and a
`needs_disambiguation` flow. All five are still open (see
`docs/open-items-2026-07-19.md` §2). This ADR researches the reference
implementation (`ralvs/jerad-ops`, private) for how it solved the same
problems, records where Dispatch follows it and where it deliberately
doesn't, and locks the vocabulary scope for the execution plan
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

## Decision 2 — audio capture persists the recording before transcribing; a failed transcription degrades to a note that points at the audio

Extending the never-lose guarantee (iron rule #4) to a new medium raises a
question text capture never had to answer: **what do you write into a
`needs_review` note when transcription fails and there is no text?**

**Decision:** audio capture gets its own `CaptureInput` variant. The audio
file uploads to the existing private `media` Storage bucket *first* — that
upload, not a `captured_data` insert, becomes the new durability point for
this medium, mirroring exactly what the raw-text insert already is for typed
capture. `captured_data` gets a row referencing the storage path
(`type: 'voice_audio_capture'`, `payload: { audio_path, mime_type, via:
'voice' }`) once the file is safely stored. Transcription then runs against
the stored file, never against bytes that only exist in memory.

If transcription fails, the capture degrades to a `needs_review` note whose
body names the medium and points at the stored audio (timestamp + path/URL),
e.g. *"Voice memo, 14:32 — transcription failed. Audio saved, not yet
transcribed."* No in-app player ships in v1; the storage URL is enough to
locate and manually replay the file if the content matters enough to
recover. The audio itself is never at risk — it was durable before the
transcription attempt was ever made.

**Revisit when** transcription failures are common enough that "go find the
file and listen to it" is a real workflow rather than a rare escape hatch —
that's when an in-app player or a retry-transcription action earns its
keep.

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
- `CaptureInput` gains an `audio` kind; `lib/services/capture/store.ts`
  gains the storage-upload durability point; `lib/ai/transcriber.ts` stops
  being a stub (gateway multimodal call, `TRANSCRIBE_MODEL`); the palette
  gains a `MediaRecorder` path for browsers where Web Speech isn't available.
- Full breakdown, files, and acceptance criteria:
  `docs/capture-vocabulary-2026-07-20.md`.
