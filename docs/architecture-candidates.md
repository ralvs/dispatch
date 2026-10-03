# Architecture candidates

The running list of deepening opportunities found by architecture reviews
(`/improve-codebase-architecture`). One file, so each review builds on the
last instead of starting cold. Vocabulary: module, interface, depth, seam,
adapter, leverage, locality (the `codebase-design` skill); domain terms from
`CONTEXT.md`.

## How a review uses this file

1. **Read it first.** Settled shapes, open candidates, rejections and the
   coverage table are the starting point.
2. **Build on settled shapes.** A settled shape is the structure a finished
   refactor left behind. A new candidate extends it. To change one, reopen it
   with the reason and the evidence, as a new ADR supersedes an old one.
3. **Every new candidate names its relations** to the open ones: _extends_,
   _depends on_, _conflicts with_, or _none_. A candidate that conflicts with a
   settled shape or an open direction says so in its first line.
4. **Update in place.** Candidate IDs are stable and never reused. Status moves
   `open → in progress → done`, or to `rejected` or `merged into AC-nn`. A done
   candidate moves its result into **Settled shapes**.
5. **Log the run** in the coverage table and the run log.

A candidate's **direction** says what the deepened module owns, in plain words.
It is not an interface: the interface is designed when the work starts.

## Work order

The order that keeps each refactor on top of the last one.

1. **AC-02** — it owns the intent → server-call pairing that AC-01's remainder
   needs.
2. **AC-06** — the optimistic half of a create/edit is the form decode; do it
   after AC-02 so the pairing has one place to call.
3. **AC-04** — narrowed after #82; small once AC-02 is in.
4. **AC-05** — independent (capture parser); any time. Prompt text must not
   change.

## Settled shapes

Do not undo these. Each names where the rule lives.

| Shape | Lives in | Source |
|---|---|---|
| A write returns `ActionResult<StoreWrite<Row>>`; the client confirms it into the store; `afterMutation` busts tags only | `lib/store/`, `lib/invalidate.ts` | ADR-0069 |
| Code lives with its only consumer; no route imports another route's folder | — | ADR-0070 |
| `projectTask` is the one per-row task rule; the task adapter owns placement (lists, day bands) | `lib/task-interaction/apply-intent.ts`, `lib/store/kinds/task.ts` | ADR-0071 |
| A task's domain follows its project, enforced by a trigger; capture precedence stays in the app | migration `20261002120000`, `lib/services/capture/resolve.ts` | ADR-0072 |
| A palette capture returns the rows it wrote and confirms them into the store | `lib/services/capture/executor.ts`, `lib/store/receive.ts` | ADR-0073 (AC-03) |
| One owner for the quiet-project rule, client and server | `lib/quiet.ts` | #82 |
| The task dialog writes every create and edit through the store itself | `components/task-dialog.tsx` | #83 |
| Deep already, leave alone: the store core, `capture()`'s never-lose boundary, the record kind factory, the capture palette machine | `lib/store/core.ts`, `lib/services/capture/index.ts`, `lib/store/kinds/record.ts`, `lib/capture/machine.ts` | run 1 |

## Open candidates

### AC-02 · Pair each intent with its server call once, per kind

- **Strength:** Strong · **Category:** in-process · **Found:** run 1
- **Files:** `lib/store/run.ts` (`useRunIntent`),
  `app/(authed)/today/routines-card.tsx:84-87`,
  `app/(authed)/routines/routine-row.tsx:43-46`,
  `lib/actions/routines.ts` (`toggleCompletionAction`); the inline-edit copies
  in `domain-row`, `project-detail`, `routine-row`, `person-detail` (×4),
  `note-editor`, `attachment-strip`.
- **Problem:** `useRunIntent(intent, action)` trusts each caller to make the
  optimistic half and the server half agree. `routines-card` sends the day in
  the intent but not to the action, so the server ticks its own today: after
  midnight, before the five-minute pull, the two disagree. The inline-edit
  error handling is copied nine times.
- **Direction:** each kind owns the server call for each of its intents, so a
  caller sends an intent and nothing else. The edit → error → close handling
  sits behind the same interface.
- **Relations:** absorbs AC-01. Builds on the ADR-0069 shape.

### AC-04 · Today's counters in one place, server and client

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Narrowed:** #82 moved the quiet rule to `lib/quiet.ts`.
- **Files:** `lib/services/today.ts:401-402`, `lib/store/kinds/task.ts:54`
  (`countsOf`), `app/(authed)/today/today-snapshots.ts:85-86`,
  `app/(authed)/projects/page.tsx:56`, `app/(authed)/projects/project-form.tsx:60`.
- **Problem:** open, overdue and inbox are counted in `assembleTodayView` and
  again in `countsOf`. A project's done count has three sources, and /projects
  seeds `project.done` but never `project.open`.
- **Direction:** one pure module says what a task row adds to each counter;
  the server reader and the task adapter both use it.
- **Relations:** extends the `lib/quiet.ts` shape. After AC-02.

### AC-05 · The parser's interface shrinks to its entry points

- **Strength:** Worth exploring · **Category:** ports & adapters (AI gateway)
  · **Found:** run 1
- **Files:** `lib/ai/parser.ts` (18 exports),
  `lib/services/capture/quick-add.ts:7-21` (`parseTaskCapture`); tests
  `parser.test.ts`, `quick-add.test.ts`, `quick-add.int.test.ts`.
- **Problem:** the parser exports its prompt fragments, so quick-add rebuilds
  the call skeleton (configured check, `generateObject`, title guard, failure
  log), and each test module-mocks `ai` and the gateway.
- **Direction:** the parser owns both prompt shapes and the call skeleton; the
  model call sits behind a seam with a gateway adapter and a fake adapter.
- **Relations:** none. Prompt text is unchanged (ADR-0061); `bun run
  eval:parser` costs money and runs only with Renan's yes.

### AC-06 · One form decode per entity, shared by the optimistic and the server half

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
- **Files:** `app/(authed)/quotes/quote-form.tsx` vs `quotes/actions.ts`;
  `app/(authed)/projects/[id]/project-detail.tsx` (`projectPatch`, own date
  regex) vs `UpdateProjectSchema`; `lib/task-interaction/optimistic-task.ts`
  vs `CreateTaskFormSchema`; `routines/routine-row.tsx`, `routine-form.tsx`.
- **Problem:** each entity decodes its form twice — by hand on the client,
  with Zod on the server — and nothing checks that they agree.
- **Direction:** the schema the action already parses with also builds the
  optimistic row or patch.
- **Relations:** after AC-02 (the pairing calls the decode).

## Parked (speculative)

Kept so a later review does not rediscover them as new. Promote with evidence.

- **AC-07 · Readers stamp and build the snapshot.** 15 pages build a
  `Snapshot` by hand; 14 cached readers set `readAt = nowUtc()` inline, and the
  "stamp before the read" rule is held in each. Run 1.
- **Day state stored as placed bands.** Every reduce re-runs
  `collectDayTasks` → `placeOnDay`; `overflow` exists so the pool can be
  rebuilt (`lib/store/kinds/task.ts`, `lib/day-schedule.ts`). Run 1.

## Done

- **AC-03 · Capture returns the rows it wrote.** Done in #85 (ADR-0073).

## Merged and rejected

- **AC-01 · Task write module** → merged into AC-02. Its dialog half was done
  in #83; what is left (`bindTaskHandlers` with injected actions and hand
  intent → payload mapping) is AC-02 for the task kind.

## Coverage

Which areas each run read closely. A review reads the empty rows first.

| Area | Runs |
|---|---|
| Entity store (`lib/store/`) | 1 |
| Task intents, day schedule (`lib/task-interaction/`, `lib/day-schedule.ts`) | 1 |
| Tasks UI, task dialog, task actions | 1 |
| Capture (`lib/services/capture/`, `lib/ai/`, `lib/capture/`, `app/api/capture`) | 1 |
| Today (`lib/services/today.ts`, `app/(authed)/today/`) | 1 |
| Projects, domains | 1 |
| Notes, note links, attachments, R2 (`lib/storage/`) | — |
| People, mentions | — |
| Routines | glance |
| Links, quotes, journal | glance |
| Notifications, push | — |
| Calendar, CalDAV, reminders sync | — |
| Crons, observations (`app/api/cron/`) | — |
| Find, chat | — |
| Cache readers, invalidation (`lib/cache/`, `lib/invalidate.ts`) | — |
| Auth, proxy, secret auth, settings | — |
| Shell, `components/`, `components/ui/` | — |
| Schemas, dates (`lib/schemas/`, `lib/dates.ts`) | — |

## Run log

| Run | Date | Base | Scope | New | Changed |
|---|---|---|---|---|---|
| 1 | 2026-10-03 | `1c2e601` | hot spots of the last 60 commits | AC-01 – AC-07 | — |
| — | 2026-10-03 | `6267b57` | re-check after #82 – #85 | — | AC-03 done; AC-01 merged into AC-02; AC-04 narrowed |
