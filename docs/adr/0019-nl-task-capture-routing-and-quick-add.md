# NL task capture: routing by name + task-scoped quick-add

Date: 2026-07-23

## Context

NL task capture already worked end-to-end via the Cmd+J palette (`parse()` →
`create_task` → `createTask`), but the vocabulary was thin: `create_task`
only carried `title, due_date?, due_time?, priority?`. "Every Monday water
plants" couldn't become a recurring task, extra context was dropped (no
notes), and every captured task landed in Inbox with no domain/project
routing. There was also no task-scoped quick entry on `/tasks` — the full
form was the only path there.

Two deliverables: **A)** enrich `create_task` with notes, recurrence, and
domain/project routing by name; **B)** a single-line NL quick-add input on
`/tasks`.

## Decision 1 — parser emits names, server resolves ids

`domain?`/`project?` on the `create_task` action are names copied verbatim
from lists (`{name}[]`) injected into the parser's system prompt — never
ids. Emitting ids would mean trusting the model not to hallucinate a UUID;
a name it can only copy from context it was actually given is a much
narrower failure surface.

A pure resolver (`lib/services/capture/resolve.ts`, `resolveTaskRouting`)
does exact, case- and diacritic-insensitive matching against the routing
lists — no fuzzy matching (deferred per ADR-0016's `match.ts`). An
unresolved name never fails the capture: the task is still created, Inbox
default, and the mention is appended to notes as
`[capture: unresolved project "X"]` for visibility at triage.

A resolved project sets `project_id` and inherits its `domain_id`; an
explicitly resolved `domain` on the same action wins over that inheritance.

> **Amended (2026-09-17): the project's own domain wins instead.** The rule
> above stored a pair the data cannot mean — a task in a Work project filed
> under Home — and it reached the database from `resolveTaskRouting`. Every
> project belongs to a domain, so naming a project already names one, and a
> contradicting `domain` from the same model is its mistake rather than a
> refinement. An unmatched domain name is still reported as unresolved.
> Where the domain is stated by a HUMAN the precedence inverts and
> the human wins: quick-add's `withStatedDomain` keeps the stated domain and
> drops the conflicting project instead (docs/adr/0043).
>
> **Amended (2026-09-19): a project always has a domain.** `projects.domain_id`
> is NOT NULL (migration `20260919120000_projects_domain_required`), so the
> "matched project with no domain" case is gone from routing and the forms.

**This is a deliberate deviation from ADR-0008's "unresolved entity →
needs_review".** A routing miss is not a capture failure — the task itself
is well-formed and worth having; Inbox triage (already the resolution
surface for undirected tasks) is where a routing miss gets fixed, not a
dead-ended review note.

## Decision 2 — routing lists fetched once, guarded

`capture/index.ts`'s `process()` calls `fetchRoutingLists(sb)` once per
capture (non-system domains, active projects) and passes:
- names (`string[]`) into the parser's `ParseContext`, so the prompt can
  name real destinations instead of guessing;
- `{id, name}` lists into the executor's `Provenance`, so `resolveTaskRouting`
  never re-queries per action.

`fetchRoutingLists` is internally guarded (try/catch → empty lists) so a
`listDomains`/`listProjects` hiccup degrades routing, never the whole
capture — the task (or note, quote, journal entry) still lands.

## Decision 3 — quick-add is task-scoped and skips `captured_data`

The `/tasks` quick-add input (`quickAddTask`, `lib/services/capture/quick-add.ts`)
is a separate, narrower seam from the firehose capture pipeline (ADR-0008):
it never writes a `captured_data` row and produces no `notifications` row
(iron rule #6 scoping) — this is a synchronous, user-initiated mutation with
its own success/failure feedback (the input itself), not an asynchronous
capture that needs a durability receipt.

Never-lose is deterministic rather than needs_review-based: any
`parseTaskCapture` failure (`unavailable` / `failed` / `empty`) creates the
task with the raw text as its title. Only a `createTask` throw surfaces —
toast, input keeps its text — the same contract the manual task form
already has.

## Decision 4 — recurrence constrained to the enum

`create_task.recurrence_rule` is `z.enum(RECURRENCE_PATTERNS)`
(`lib/recurrence.ts`), so the model can never emit a value that would
violate the `tasks.recurrence_rule` check constraint. An unrepresentable
cadence ("every 3 weeks") is omitted by the parser; the prompt instructs it
to keep the phrase in `notes` instead of guessing the closest enum member.

## Risks accepted

- **Optimistic title flicker on quick-add.** The optimistic row shows the
  raw text as the title (Inbox, no routing); when the server action
  resolves and the page revalidates, the parsed title/routing/recurrence
  swap in. For a typical quick-add (a few hundred ms) this reads as a brief
  correction, not a bug — accepted rather than delaying the optimistic
  insert until the parse completes (which would defeat the point of
  optimistic UI).
- **Exact-name matching is strict** ("Reviews" ≠ "Reviews plugin") until
  ADR-0016's fuzzy `match.ts` lands. The prompt's "copy the name EXACTLY as
  listed" instruction carries the load in the meantime.
- **Prompt growth from routing lists is bounded** by this being a
  single-user app; revisit (cap at ~50 names, or summarize) if domains/
  projects ever grow enough to bloat the system prompt.

## Non-goals

- No DB migration — `tasks.notes/recurrence_rule/domain_id/project_id`
  already existed.
- No candidate picker for ambiguous routing — same reasoning as ADR-0016
  Decision 1; a miss degrades to Inbox + a notes mention, not a UI.
