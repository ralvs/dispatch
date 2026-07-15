# Architecture fixes — pre-Phase-2 hardening plan

Output of the 2026-07-15 architecture review (deep-module pass over the code
built so far plus the plan the ADRs commit to). **Execute before Phase 2 (AI
capture pipeline) starts** — three of the six iron rules are currently
enforced by discipline only, and the next phase is exactly where
discipline-only rules break.

Each item is independently committable (Conventional Commits, one commit per
item). Run `bun run check` before every commit.

## Status (2026-07-15)

Executed same-day.

- **1** — done (`9e5f2d0`).
- **2** — done (`0ab6b41`, review fixes in `ffbf8df`; cross-family peer review
  applied — `recordedAction`'s entry is now derived from the action result;
  known limits documented: not crash-atomic, not a hard boundary; the first
  cron/ingest caller must bring an idempotency key).
- **3** — done (`772bfa8`).
- **4** — intentionally **not done**. This is the Phase-2 opening design
  decision and remains the next task.
- **5** — done (`e5d3a87`).
- **6** — done (`23764a5`; migration applied to the remote Supabase project).
- **7** — needed no standalone action; absorbed by items 2 and 5.
- Field-note fixes — done (`da35fe6`: auth fail-closed test, env coercion
  test, `completeTask` recurrence-wiring test; `CONTEXT.md` created in
  `bd0f9b1`).

## 1. Couple the owner guard to the RLS client — Strong

**Files:** `lib/auth.ts`, `lib/supabase/server.ts`, `app/(authed)/tasks/actions.ts`, `app/(authed)/layout.tsx`

Iron rule #2 (`requireOwner()` first line) is convention: nothing couples
`createRlsClient()` to a prior guard, so a new action that forgets it compiles
fine and falls back to RLS alone.

- `requireOwner()` / `requireOwnerPage()` return the RLS client: `const sb = await requireOwner()`.
- `createRlsClient()` becomes private to the auth module (not exported from `lib/supabase/server.ts` for general use).
- Update all existing call sites in actions and pages.
- Reinforces ADR-0003; no ADR change needed.

## 2. Notification ledger seam — Strong (required before any autonomous feature)

**Files:** `lib/services/notifications.ts` (new); `notifications` table already in `supabase/migrations/0001_schema.sql`

Iron rule #6 ("every autonomous/external action writes a `notifications` row")
has zero code. Build a ledger module whose interface performs the mutation
*and* records it in one call (e.g. `recordedAction(sb, …)`); cron/ingest/
CalDAV write paths go only through this interface, never a raw client. Push
delivery slots in behind the same seam later (ADR-0005).

## 3. Give the Task one shape — Strong

**Files:** `lib/schemas/task.ts`, `lib/services/tasks.ts:7-27`, `app/(authed)/tasks/actions.ts:25-37`, `app/(authed)/tasks/task-row.tsx:10-11`, `app/(authed)/today/page.tsx:19-23`

Task fields live in four hand-synced copies (`TaskRow` + `TASK_SELECT`, the
unimported `TaskSchema`, the inline action `CreateTaskSchema`, and per-
component overdue/top-3 derivation).

- `lib/schemas/task.ts` becomes the single source of truth.
- Service derives `TaskRow` and `TASK_SELECT` from the schema; actions import `CreateTaskSchema` instead of redeclaring it.
- Move day-level predicates (`isOverdue`, `isTop3Today`) into the task module as tested pure functions — this is where ADR-0002's timezone rule can silently break today.
- Leaves a clean wire-in path for `reminder_offsets` / `reminders_sent` (currently omitted from every copy).

## 4. Design capture around the never-lose guarantee — decide before writing `app/api/ingest`

**Files:** `lib/schemas/voice.ts`, `lib/schemas/captured.ts`, planned `app/api/ingest`, `lib/ai`, `lib/services/notes.ts`

Iron rule #4 ("never lose a capture") has no seam: `voice.ts` prescribes a
15-variant action union pointing at an executor that doesn't exist, and the
degradation target (a `needs_review` note) has no write path.

- One deep capture module: `capture(sb, raw) → CapturedRecord`, which **persists the raw input first**, then transcribes/parses internally.
- Transcriber and parser are adapters behind internal seams with **typed fallbacks that never throw** into the capture path; any failure degrades to a `needs_review` note.
- Requires a `notes` service write path before or with this work.
- This is a design decision for the start of Phase 2 — treat the existing schemas as a draft interface to renegotiate, not a contract.
- Touches ADR-0004 (gateway) — no conflict, but fallback typing belongs in the same design conversation.

## 5. `unwrap()` the error-shaping ritual — Worth exploring

**Files:** `lib/services/tasks.ts` (10 sites), `lib/services/settings.ts`

`const { error } = await …; if (error) throw error;` is copy-pasted 14×, and
throws are untyped Supabase errors (violates the typed-error convention). Add
one `unwrap()` helper in a shared services module returning/throwing a typed
`ServiceError`; migrate existing sites; all future services use it.

## 6. Align the recurrence vocabulary — contains a real latent defect

**Files:** `lib/recurrence.ts:8-16`, `supabase/migrations/0001_schema.sql:184-185, 214`, new migration

The pattern list exists in three places and has already diverged:
`RECURRENCE_PATTERNS` has 7 values (incl. `semiannually`), the
`project_checklist_items.recurrence_rule` CHECK lists only 6 (**rejects
`semiannually`**, which `periodStart`/`nextDueDate` handle), and
`tasks.recurrence` is free text with no CHECK.

- New migration: align the checklist CHECK to the 7-value list and add a CHECK to `tasks.recurrence`.
- `lib/recurrence.ts` owns the vocabulary; Zod derives from `RECURRENCE_PATTERNS`.

## 7. Pass-through mutators — no standalone action

`updateTask` / `reopenTask` / `deleteTask` / `triageTask`
(`lib/services/tasks.ts:95-171`) and `updateAppTimezone` are shallow
(interface ≈ one-line implementation), but the deletion test says keep: they
hold the seam where items 2 and 5 land. Deepen via those; revisit only if
still bare afterwards.

## Field-note fixes (cheap, high value)

- **Test the security predicates:** `lib/auth.ts` fail-closed owner check and `lib/env.ts` empty-string-→-unset coercion have zero tests — highest-value cheap tests in the repo.
- **Test `completeTask`'s recurrence wiring** (`lib/services/tasks.ts:118-143`): the math is tested, the wiring is not — recurring completions roll `due_date` but never set `completed_at`/`status='done'`; nothing asserts that's intended.
- **Create `CONTEXT.md`** (domain glossary): *capture*, *triage*, *top-3*, *stewardship domain*, *needs_review* are load-bearing and undefined. Create it during whichever design session comes first.
- **Schemas run ahead of code:** 34 of 37 tables and most of `lib/schemas/` have zero callers; `lib/routine-stats.ts` is tested but dead. No action now — but each feature should renegotiate its pre-written schema instead of satisfying it blindly.

## Suggested order

1 → 6 → 5 → 3 → field-note tests → 2 → 4 (design, opening Phase 2).
Items 1, 5, 6 are small mechanical diffs; 3 is a contained refactor; 2 and 4
are design work that must precede the autonomous/capture features.
