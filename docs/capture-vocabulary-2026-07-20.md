# Capture vocabulary growth and audio transcription — execution plan

Output of research into ADR-0008's deferred list against the reference
implementation (`ralvs/jerad-ops`). Owner decisions locked in
[`docs/adr/0016-capture-vocabulary-growth-and-audio-transcription.md`](./adr/0016-capture-vocabulary-growth-and-audio-transcription.md) —
**read that ADR first**, it settles two design questions this plan assumes
answers to (ambiguity → `needs_review`, no picker; audio failure → a note
pointing at the stored file).

| | |
|--|--|
| **Status** | Planned — not started |
| **Decisions ADR** | [`docs/adr/0016-…`](./adr/0016-capture-vocabulary-growth-and-audio-transcription.md) |
| **Reference read** | `ralvs/jerad-ops` (private): `apps/api/src/lib/{match,parser,executor}.ts`, `apps/web/src/lib/voice-actions.ts` |
| **Supersedes** | ADR-0008's "Deferred" list, items 2.1–2.4 in `docs/open-items-2026-07-19.md` |

Each numbered item is **independently committable**. Run `bun run check`
before every commit. Author: `Renan Alves <renan@alves.id>`.

**Iron rules still apply:** UTC at boundary, `requireOwner()` first line on
session surfaces, services take `sb` first, never lose a capture (this plan
is entirely in service of that rule, for two new cases), autonomous/external
actions write `notifications` (capture from the palette still does not —
user-initiated, unchanged from ADR-0008).

---

## Status

| # | Item | Status |
|---|------|--------|
| 0 | ADR-0016 | done (doc only) |
| 1 | Entity-resolution module (`lib/services/capture/match.ts`) | pending |
| 2 | Capture context for the parser | pending |
| 3 | `complete_task` verb | pending |
| 4 | `create_project` / `update_project_status` / `create_person_fact` verbs | pending |
| 5 | Ambiguity → `needs_review` prompt rule | pending |
| 6 | Real transcriber (`lib/ai/transcriber.ts`) | pending |
| 7 | Audio `CaptureInput` + persist-first storage upload | pending |
| 8 | Palette audio-recording UI | pending |
| 9 | Docs touch-up | pending |

---

## 1. Entity-resolution module — Strong

**Files:** `lib/services/capture/match.ts` (+ `match.test.ts`)

**Do:**

- Port the reference's scoring algorithm: `matchScore(query, target)` — exact
  match wins outright; a full substring hit (either direction) scores
  `0.6 + 0.3 × lengthRatio`; otherwise word-overlap (words > 2 chars) scores
  `(hits / queryWords) × 0.55`. Threshold **0.5** to actually resolve.
- `bestMatch(query, candidates: {id, label}[])` — pure, picks the highest
  scorer above threshold or `null`. This and `matchScore` are the
  unit-tested half (no database).
- `matchTask(sb, query)` — open tasks only (`status = 'open'`), matches by
  `title`. Mirrors `listTasks(sb, {status:"open"})`.
- `matchProject(sb, query)` — active projects, matches by `name`.
- `matchDomain(sb, query)` — active domains, matches by `name`.
- `matchPerson(sb, query)` — all people, matches by `name`.
- Every `matchX` returns `Promise<string | null>`; `query === undefined`
  short-circuits to `null` without a query.

**Acceptance:**

- `matchScore`/`bestMatch` unit tests cover: exact match, substring both
  directions, word-overlap above/below threshold, empty query, empty
  candidate list, a tie (first-highest wins, documented).
- No behavior change to any existing page — this module has no callers yet.

**Commit sketch:** `feat(capture): fuzzy entity-resolution module`

---

## 2. Capture context for the parser — Strong

**Files:** `lib/ai/capture-context.ts` (new, + test), `lib/ai/parser.ts`,
`lib/services/capture/index.ts`

**Do:**

- `gatherCaptureContext(sb)` — parallel-fetches open tasks (title only,
  capped e.g. 100), active projects (name), active domains (name), and
  "recent" people (name — reuse `listPeople` capped, e.g. 100; Dispatch has
  no interaction-recency table to scope by like the reference does, so cap
  by count instead of a 30-day window). Mirrors `lib/ai/chat-context.ts`'s
  shape and caps.
- `renderCaptureContext` (pure) — turns the gathered snapshot into the JSON
  block the parser's **user message** carries (not the cached system
  prompt — per-request context must not break the cached prefix, matching
  the reference's caching note).
- `parse()` in `lib/ai/parser.ts` gains this context as an input; the system
  prompt explains what the `*_match` fields are for and that the backend
  resolves them (the model never invents an id, only a short phrase).
- `process()` in `lib/services/capture/index.ts` gathers this context
  alongside the existing `tz`/`todayIso`/`nowUtc` fetch (one more
  `Promise.all` member) and passes it through.

**Acceptance:**

- `renderCaptureContext` unit-tested: empty lists render sensibly, caps are
  enforced even given an unbounded input list.
- No existing capture path changes behavior — v1 verbs still work with an
  empty vocabulary-match context (extra prompt content only).

**Commit sketch:** `feat(capture): gather task/project/domain/person context for the parser`

---

## 3. `complete_task` verb — Strong (do first among the vocabulary items)

**Depends on:** 1, 2.

**Files:** `lib/schemas/capture.ts`, `lib/services/capture/executor.ts`,
`lib/ai/parser.ts`

**Do:**

- Schema variant: `{ action: "complete_task", task_match: string }`.
- Executor case: `matchTask(sb, action.task_match)`; no match → throw (falls
  into the existing per-action `catch` → degrades to a `needs_review` note
  whose body is the verbatim transcript, same as every other action
  failure — no new failure path). A match → `completeTask(sb, id,
  todayIso)`.
- `Provenance` (executor.ts) gains `todayIso` — `completeTask` needs it for
  recurrence rolling; `tz` alone isn't enough. Threaded from the same place
  `tz` already is in `process()`.
- Prompt: add `complete_task` to the vocabulary list; instruct the model
  to use it when the utterance clearly means "mark X done" / "I finished
  X", with `task_match` a short phrase, resolved against `openTasks` in
  context.

**Acceptance:**

- Executor unit test: matched task → `completeTask` called with resolved
  id; unmatched → the action throws and the existing degrade path fires (no
  new test double needed beyond what `executor.test.ts` presumably already
  has for other actions — extend it, don't reinvent it).
- A recurring task marked done via this verb rolls its due date the same as
  completing it from `/tasks` does (same `completeTask` call, so this
  should hold by construction — assert it in the test regardless).
- `bun run check` green.

**Commit sketch:** `feat(capture): complete_task verb`

---

## 4. `create_project` / `update_project_status` / `create_person_fact` verbs — Strong

**Depends on:** 1, 2. Parallel-safe with item 3.

**Files:** `lib/schemas/capture.ts`, `lib/services/capture/executor.ts`,
`lib/ai/parser.ts`

**Do:**

- `create_project`: `{ name, domain_match?, target_date? }`. Executor:
  `matchDomain` (optional — falls through to whatever `createProject`
  defaults to when `domain_id` is omitted; check `CreateProjectSchema`'s
  actual default before assuming Inbox-equivalent behavior for projects,
  since projects and tasks don't necessarily share that fallback).
- `update_project_status`: `{ project_match, status }`,
  `status ∈ ProjectStatusSchema` (`active|paused|done|archived`). Executor:
  `matchProject` (no match → throw → degrade); dispatch to
  `completeProject`/`archiveProject` for those two statuses, `updateProject`
  otherwise.
- `create_person_fact`: `{ person_match, fact_type, fact_value,
  date_relevant?, recurring? }`, `fact_type ∈ PersonFactTypeSchema`.
  Executor: `matchPerson` (no match → throw → degrade — this verb **never**
  creates a person, matching the reference and ADR-0016).
- Prompt: add all three, with `fact_type`'s enum values spelled out (mirror
  the reference's prompt style — enum values inline, not just "see schema").

**Acceptance:**

- Executor unit tests per verb: happy path (existing entity resolves,
  correct service called with correct args) and miss path (degrades, never
  throws out of `runOne`).
- `update_project_status` → `"done"` stamps `completed_at` (via
  `completeProject`, already tested there — assert the executor calls the
  right service, not the service's own behavior again).
- `bun run check` green.

**Commit sketch:** `feat(capture): create_project, update_project_status, create_person_fact verbs`

---

## 5. Ambiguity → `needs_review` prompt rule — Cheap

**Depends on:** 2 (needs the context to have something to be ambiguous about).

**Files:** `lib/ai/parser.ts` (prompt only)

**Do:**

- Add the rule from ADR-0016 Decision 1: when a `*_match` phrase plausibly
  names 2+ entities present in the given context, emit `needs_review` with
  `reason` naming what it saw, instead of guessing at one.
- No schema change (`needs_review` already carries `reason` +
  `proposed_kind`), no executor change, no new tests beyond a prompt-content
  sanity check if `parser.test.ts` already asserts on prompt substrings
  (match the existing test's style — don't invent a new testing approach
  for one prompt rule).

**Acceptance:**

- Manual: capture an utterance naming two similarly-titled open tasks (e.g.
  two tasks both containing "review") ambiguously ("mark the review task
  done") and confirm it degrades to `needs_review` rather than guessing one.
  This is the one item in this plan that needs a live model call to verify
  — unit tests can't assert model judgment, only that the schema still
  accepts the resulting shape.

**Commit sketch:** `feat(capture): ambiguous entity references degrade to needs_review`

---

## 6. Real transcriber — Strong

**Files:** `lib/ai/gateway.ts`, `lib/ai/transcriber.ts` (+ test)

**Do:**

- `gateway.ts` gains `transcriberModel()` — same shape as `parserModel`/
  `chatModel`, reading `env().TRANSCRIBE_MODEL` (already defaulted to
  `google/gemini-2.5-flash`, currently unused).
- `transcriber.ts`: replace the stub with a real `generateText` call, one
  multimodal user message —
  `content: [{ type: "text", text: <instruction> }, { type: "file", data:
  <audio bytes>, mediaType: input.mimeType }]`. Instruction: transcribe
  verbatim; the speaker may use Portuguese (pt-BR) or English — transcribe
  in whichever was spoken, never translate (ADR-0004's bilingual-verbatim
  rule applies to transcription too, not just the parser).
- Guard with `isAiConfigured()` → `unavailable`, exactly like `parser.ts`
  does. Empty/whitespace-only result → `failed` (nothing was said, or the
  model produced nothing usable) rather than a false-positive empty
  transcript reaching `capture()`.
- Errors from the gateway call → `failed`, never thrown.

**Acceptance:**

- Unit tests (mock `generateText`, same style as `parser.test.ts` mocks
  `generateObject`): unavailable when ungated, failed on rejection, failed
  on empty text, ok on a real-shaped response.
- No caller yet — this item lands the seam only, matching how item 3 of the
  ops-shell plan landed `buildDaySchedule` before Today's UI used it.

**Commit sketch:** `feat(ai): real audio transcription via the gateway`

---

## 7. Audio `CaptureInput` + persist-first storage upload — Strong

**Depends on:** 6.

**Files:** `lib/services/capture/index.ts`, `lib/services/capture/store.ts`,
`lib/capture/receipt.ts`, `lib/supabase/admin.ts` or wherever a storage
upload helper belongs

**Do:**

- `CaptureInput` gains a variant:
  `{ kind: "audio"; audioPath: string; mimeType: string; via: "voice";
  clientTime?: string }`. Note **`audioPath`**, not raw bytes — the upload
  to the `media` bucket happens *before* `capture()` is called at all (the
  server action in item 8 does it), so the durability point for this medium
  is the storage write, exactly as the raw-text insert is for typed
  capture. `capture()` itself never receives bytes it could lose.
- `persistRaw` (store.ts): for `kind: "audio"`, insert `captured_data` with
  `type: 'voice_audio_capture'`, `payload: { audio_path, mime_type, via }`
  (no `transcript` key — nothing to put there yet).
- `process()` (index.ts): branch on `raw.kind`. For `"audio"`: fetch the
  file from storage, call `transcribe()`. On success, proceed through the
  *existing* parse/execute pipeline unchanged, using the resulting text as
  if it were typed. On failure, degrade per ADR-0016 Decision 2 — a
  `needs_review` note whose body names the medium, a timestamp, and the
  storage path/URL (not the verbatim-transcript body the text path uses,
  since there is no transcript).
- `deriveReceipt` (receipt.ts): the palette needs a way to tell "audio,
  transcription failed" apart from the text-path `needs_review` reasons it
  already renders — extend `reviewLines` (or the reason union) rather than
  introducing a whole new tone; the receipt is otherwise the same shape.

**Acceptance:**

- Unit tests: audio persist-first is asserted with a mocked storage
  client — the `captured_data` insert happens, and a transcription failure
  never causes an exception to reach the caller (same no-throw-boundary
  contract as the text path, exercised for the new branch).
- A successful transcription's resulting `CapturedRecord` is
  indistinguishable in shape from a text capture's — same `outcome` union,
  so nothing downstream (widget, chat context, receipt) needs to special-case
  audio once transcription succeeds.
- `bun run check` green.

**Commit sketch:** `feat(capture): audio input persists to storage before transcribing`

---

## 8. Palette audio-recording UI — Strong

**Depends on:** 7.

**Files:** `components/capture-palette.tsx`, new
`app/(authed)/capture/actions.ts` export (or a sibling action), possibly a
small `lib/capture/use-audio-capture.ts` hook mirroring
`use-speech-capture.ts`'s shape

**Do:**

- A `MediaRecorder`-backed hook, same shape as `useSpeechCapture` (supported/
  recording/start/stop), so the palette's dictation UI and this one compose
  similarly. `supported` gates on `MediaRecorder` + `getUserMedia` existing.
- Surfaces as a fallback when `speech.supported` is `false` (the primary
  case this closes — browsers with no usable Web Speech, notably some iOS
  Safari versions) — not necessarily a second control alongside a working
  mic button. Confirm the actual behavior with a manual check on a browser
  where Web Speech is genuinely unavailable before deciding whether to also
  offer it as an alternative when Web Speech *is* available.
- New server action (FormData, matching `captureText`'s shape): receives
  the recorded `Blob`, uploads it to the `media` bucket under a per-capture
  path, then calls `capture(sb, { kind: "audio", audioPath, mimeType,
  via: "voice" })`. Same `revalidatePath` calls as `captureText`.
- Capture machine (`lib/capture/machine.ts`): decide whether this needs new
  states or can reuse `"listening"`/`"submitting"` with a flag — recording
  audio and dictating text are different user actions but arguably the same
  *shape* of state machine (idle → recording/listening → submitting →
  done/error). Prefer reusing the existing states if the semantics genuinely
  match; don't fork the machine for cosmetic reasons.

**Acceptance:**

- Manual: on a browser/device where `speech.supported` is false, the
  palette offers audio recording instead of no voice option at all; a
  recorded memo round-trips to a real capture with the same receipt UI text
  path captures get.
- Mic permission denial degrades gracefully (an error state, not a crash) —
  same bar `use-speech-capture.ts` already holds for `SpeechRecognition`
  failures.

**Commit sketch:** `feat(capture): audio recording in the palette for browsers without Web Speech`

---

## 9. Docs touch-up — Cheap

**Files:** `CONTEXT.md`, `docs/adr/0008-…md` (Deferred-list status line),
`docs/open-items-2026-07-19.md` (§1.2/§2 pointers), `docs/status.html`, this
file's status table

**Do:** Glossary entries for `complete_task`/entity resolution/audio capture;
close out ADR-0008's Deferred list fully; update the open-items doc so §2
points here instead of restating "still deferred"; status only, no product
code.

**Commit sketch:** `docs: capture vocabulary and audio transcription glossary`

---

## Explicitly out of scope (this plan)

| Item | Notes |
|------|-------|
| `log_activity` | No `activity_log` service layer exists — a new service, not a growth-path wire-in. Separate plan if wanted. |
| `update_milestone` | Cheap but needs double resolution (project → milestone). P2 stretch. |
| `create_calendar_event` via voice | Dispatch creates events through CalDAV push (`createEventHere`, ADR-0006) — a different, already-decided path. |
| Interactive disambiguation picker | ADR-0016 Decision 1 — folds into `needs_review` instead. |
| In-app audio playback for failed transcriptions | ADR-0016 Decision 2 — a storage URL is enough for v1. |
| `create_quote_annotation`, `set_resurface_weight`, `update_content_item`, `add_inventory_item` | No UI/service surface for the first two; content pipeline and inventory were cut (ADR-0007, and inventory was never built here). |
| Creating a new person by voice | Reference doesn't do this either — facts only attach to existing contacts. |

---

## Suggested order

```
0 (done) → 1 ⟷ 2 (parallel) → 3 ⟷ 4 (parallel) → 5 → 6 → 7 → 8 → 9
```

Rationale:

- **1 and 2** are independent (executor-side resolution vs. parser-side
  context) and both are prerequisites for every vocabulary verb — build
  them in parallel, land both before any verb.
- **3 and 4** are independent verb sets sharing 1+2's foundation — parallel-
  safe.
- **5** needs 2's context to have anything to be ambiguous about, so it
  follows the verb items (though it's a prompt-only change and could
  technically land earlier — sequenced last among the vocabulary items
  because it's the one acceptance criterion needing a live model call to
  verify, and it's easier to verify against a vocabulary that already
  exists).
- **6 → 7 → 8** is the classic seam → pipeline → UI progression ops-shell
  used for Ingest (5 → 6 → 7). The audio track has no dependency on the
  vocabulary track (1–5) and could run fully in parallel with it.
- **9** last, after everything it documents has landed.

---

## Agent checklist (every item)

1. Read ADR-0016 + this item's **Files** / **Do** / **Acceptance**.
2. Match existing patterns (`unwrap`, per-action isolation in the executor,
   colocated `*.test.ts`, Biome tabs width 100).
3. `bun run check` before commit.
4. Conventional Commit; incremental; author as in `CLAUDE.md`.
5. Update **Status** table in this file when done.
6. A new product decision that diverges → a new ADR under `docs/adr/`, same
   as ADR-0016 did for the two calls this plan already made.
