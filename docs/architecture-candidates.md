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
   refactor left behind, or a module a review judged already deep. A new
   candidate extends it. To change one, reopen it with the reason and the
   evidence, as a new ADR supersedes an old one.
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

1. **AC-02** — owns the intent → server-call pairing; AC-06 and AC-04 build on
   it.
2. **AC-08** — independent of AC-02; two live bugs (below). Can run beside it.
3. **AC-06** — the optimistic half of a create or edit is the form decode; it
   plugs into AC-02's pairing.
4. **AC-07** — the read side of the store; independent, after AC-02 settles
   what a write returns.
5. **AC-04** — small once AC-02 is in.
6. **AC-09** — independent (calendar sync); any time.
7. **AC-05** — independent (capture parser); any time. Prompt text must not
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
| Mutation → tags is one pure table | `lib/invalidate.ts` (`invalidationFor`) | run 2 |
| The absent-versus-blank form rule lives in one place | `lib/form-decode.ts` | run 2 |
| Owner checks: one small interface over session rotation; external routes fail closed | `lib/auth.ts`, `lib/secret-auth.ts` | run 2 |
| Note files: a four-function storage port over R2, and one module keeping bytes and row in step | `lib/storage/`, `lib/services/note-attachments.ts`, `lib/attachments.ts` | run 2 |
| Deep already, leave alone: the store core, `capture()`'s never-lose boundary, the record kind factory, the capture palette machine, the CalDAV connection adapter, the mention parser, debounced save, the chat context render | `lib/store/core.ts`, `lib/services/capture/index.ts`, `lib/store/kinds/record.ts`, `lib/capture/machine.ts`, `lib/caldav/client.ts`, `lib/mentions.ts`, `lib/debounced-save.ts`, `lib/ai/chat-context.ts` | runs 1–2 |

## Open candidates

### AC-02 · Pair each intent with its server call once, per kind

- **Strength:** Strong · **Category:** in-process · **Found:** run 1 ·
  **Widened:** run 2
- **Files:** `lib/store/run.ts` (`useRunIntent`, `useStoreWrite`),
  `components/ui/use-result-action.ts:25-42`,
  `app/(authed)/today/routines-card.tsx:84-87`,
  `app/(authed)/routines/routine-row.tsx:43-46`,
  `lib/actions/routines.ts` (`toggleCompletionAction`, `writtenRoutine`),
  `app/(authed)/notes/actions.ts:40` (`writtenNote`),
  `app/(authed)/people/[id]/actions.ts:48-49`; the inline-edit copies in
  `domain-row`, `project-detail`, `routine-row`, `person-detail` (lines 134,
  152, 351, 496), `note-editor`, `attachment-strip`.
- **Problem:** `useRunIntent(intent, action)` trusts each caller to make the
  optimistic half and the server half agree. `routines-card` sends the day in
  the intent but not to the action, so the server ticks its own today: after
  midnight, before the five-minute pull, the two disagree. Failure → toast is
  written three ways (`useRunIntent`, `useStoreWrite`, `useResultAction`),
  the inline-edit handling is copied nine times, and each route writes its own
  read-back of the written row.
- **Direction:** each kind owns the server call for each of its intents, so a
  caller sends an intent and nothing else. The edit → error → close handling
  and the read-back of the written row sit behind the same interface.
- **Relations:** absorbs AC-01. Builds on the ADR-0069 shape.

### AC-08 · An external action owns its ledger row, its delivery and its tags

- **Strength:** Strong · **Category:** ports & adapters (web push) ·
  **Found:** run 2
- **Files:** `lib/services/notifications.ts:104-115` (`recordNotification`),
  `app/api/cron/sweep/route.ts:33-41`,
  `app/api/cron/observations/route.ts:35-43`,
  `app/api/capture/route.ts:102-114,133-144`,
  `app/api/calendar/bridge/route.ts:47-58`,
  `lib/services/capture/executor.ts:98-106`,
  `lib/invalidate.test.ts:233-294`.
- **Problem:** each caller wires three things by hand.
  - The ledger row is best-effort (ADR-0015) in capture, the bridge and the
    executor, which wrap it in `try`; the sweep and observations crons call it
    bare, so a ledger failure turns a committed sweep into a 500.
  - Each caller busts the ledger's tag itself; only source-grep tests hold it.
  - Whether a push goes out depends on the client passed in: "Only a
    service-role `sb` (cron/capture/autonomous callers) actually pushes". So a
    palette capture that books an event (RLS client) records it and never
    pushes.
- **Direction:** one module owns "an autonomous or external action happened":
  the row (best-effort), its delivery, and the ledger's tags. Who hears about
  an entry is that module's decision, not a side effect of RLS.
- **Relations:** none with open candidates. Builds on `EXTERNAL_WRITES`.
  Touches iron rule #3 (push would stop depending on the caller's `sb`) and
  ADR-0001 (a service calling `next/cache`): decide both before the work.

### AC-06 · One form decode per entity, shared by the optimistic and the server half

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Widened:** run 2
- **Files:** `app/(authed)/quotes/quote-form.tsx:36-39` vs
  `quotes/actions.ts:29-36`; `journal/actions.ts:24-31` (same `tagsFromForm`);
  `app/(authed)/projects/[id]/project-detail.tsx` (`projectPatch`, own date
  regex) vs `UpdateProjectSchema`; `lib/task-interaction/optimistic-task.ts`
  vs `CreateTaskFormSchema`; `routines/routine-row.tsx`, `routine-form.tsx`;
  `app/(authed)/people/[id]/actions.ts:45`.
- **Problem:** each entity decodes its form twice — by hand on the client,
  with Zod on the server — and nothing checks that they agree. `tagsFromForm`
  is copied in two actions and decoded a third time by hand.
  `lib/form-decode.ts` is client-safe but only actions use it. The server
  half's error contract varies: `updatePersonAction` decodes outside
  `runFormAction`, so a validation error reaches the client as a generic
  failure (`createPersonAction` is right).
- **Direction:** the schema the action already parses with, through
  `lib/form-decode.ts`, also builds the optimistic row or patch.
- **Relations:** extends the `lib/form-decode.ts` shape. Plugs into AC-02.

### AC-07 · Cached readers stamp the read and build the snapshot

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Promoted:** run 2
- **Files:** 14 readers in `lib/cache/*.ts` with `const readAt = nowUtc()`;
  15 pages with `const snapshot: Snapshot`; `lib/store/server.ts:9`
  (`stampRead`, one caller: `today/actions.ts:43`).
- **Problem:** the store's rule "stamp before the read" is held by hand in 14
  readers, which bypass the helper meant to own it; every page repeats the
  timezone, today and snapshot assembly.
- **Direction:** a cached reader returns a stamped snapshot; a page only seeds
  it.
- **Relations:** builds on the ADR-0069 conflict rule. AC-11 (parked) is the
  same readers' tag declarations.

### AC-04 · Today's counters in one place, server and client

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Narrowed:** #82 · **Widened:** run 2
- **Files:** `lib/services/today.ts:401-402`, `lib/store/kinds/task.ts:54`
  (`countsOf`), `app/(authed)/today/today-snapshots.ts:85-86`,
  `app/(authed)/projects/page.tsx:56`, `app/(authed)/projects/project-form.tsx:60`,
  `lib/services/observations.ts:195-200`, `lib/store/kinds/domain.ts:12`.
- **Problem:** open, overdue and inbox are counted in `assembleTodayView` and
  again in `countsOf`. A project's done count has three sources, and /projects
  seeds `project.done` but never `project.open`. Each domain's open count is a
  fourth, and since the domain kind is a plain record kind, a tick never moves
  it.
- **Direction:** one pure module says what a task row adds to each counter;
  the server readers and the task adapter both use it.
- **Relations:** extends the `lib/quiet.ts` shape. After AC-02.

### AC-09 · One calendar mirror, two source adapters

- **Strength:** Worth exploring · **Category:** ports & adapters · **Found:**
  run 2
- **Files:** `lib/services/calendar.ts:42-135`,
  `lib/services/calendar-bridge.ts:35-132`, `app/api/cron/caldav/route.ts:44-53`.
- **Problem:** CalDAV and the EventKit bridge each write the same reconcile:
  load known rows by uid, skip unchanged, upsert, delete what was not seen in
  the window, stamp a sync-state row. The empty-snapshot rule differs and lives
  in a comment ("intentionally clears the window (unlike CalDAV's failed-fetch
  guard)"). CalDAV's sync state is written in two places: the service on
  success, the route on failure.
- **Direction:** the mirror owns the reconcile for one source and window,
  including success and failure state; CalDAV and the bridge are adapters that
  hand it a snapshot and say whether an empty one can be trusted.
- **Relations:** none.

### AC-05 · The parser's interface shrinks to its entry points

- **Strength:** Worth exploring · **Category:** ports & adapters (AI gateway)
  · **Found:** run 1 · **Confirmed:** run 2
- **Files:** `lib/ai/parser.ts` (18 exports),
  `lib/services/capture/quick-add.ts:6-21` (`parseTaskCapture`); tests
  `parser.test.ts`, `quick-add.test.ts`, `quick-add.int.test.ts`.
- **Problem:** the parser exports its prompt fragments, so quick-add rebuilds
  the call skeleton (configured check, `generateObject`, title guard, failure
  log), and each test module-mocks `ai` and the gateway.
- **Direction:** the parser owns both prompt shapes and the call skeleton; the
  model call sits behind a seam with a gateway adapter and a fake adapter.
- **Relations:** none. Prompt text is unchanged (ADR-0061); `bun run
  eval:parser` costs money and runs only with Renan's yes.

## Parked (speculative)

Kept so a later review does not rediscover them as new. Promote with evidence.

- **AC-10 · Derived graph edges reconcile once.** `syncMentions` copies
  `syncWikilinks`' reconcile ("mirrors syncWikilinks' full-reconcile shape"),
  the swallow-on-capture policy exists in `mentions.ts` (`withGraphFail`) and
  again in `notes.ts`, and NFD name folding is written three times
  (`lib/mentions.ts:34`, `capture/resolve.ts:44`, `capture/match.ts:51`).
  Two callers only. Run 2.
- **AC-11 · A reader's declared writes are checked one way only.**
  `lib/invalidate.test.ts` checks that each declared write busts the tag, not
  that the list is complete. `getCachedNoteLinks` and `getCachedTaskBoard`
  read `note_links` but do not list `notes.links`; they pass because it also
  busts `notes`. Same readers as AC-07. Run 2.
- **Day state stored as placed bands.** Every reduce re-runs
  `collectDayTasks` → `placeOnDay`; `overflow` exists so the pool can be
  rebuilt (`lib/store/kinds/task.ts`, `lib/day-schedule.ts`). Run 1.

## Done

- **AC-03 · Capture returns the rows it wrote.** Done in #85 (ADR-0073).

## Merged and rejected

- **AC-01 · Task write module** → merged into AC-02. Its dialog half was done
  in #83; what is left (`bindTaskHandlers` with injected actions and hand
  intent → payload mapping) is AC-02 for the task kind.

## Side findings

Bugs a review saw that are not architecture. Fix and delete the line.

- `lib/ai/chat-context.ts:58` tells the model "Timezone is America/Sao_Paulo"
  although the function receives `tz` (iron rule #1). Run 2.

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
| Notes, note links, attachments, R2 (`lib/storage/`) | 2 |
| People, mentions | 2 |
| Routines | 2 |
| Links, quotes, journal | 2 |
| Notifications, push | 2 |
| Calendar, CalDAV, reminders sync | 2 |
| Crons, observations (`app/api/cron/`) | 2 |
| Find, chat | 2 |
| Cache readers, invalidation (`lib/cache/`, `lib/invalidate.ts`) | 2 |
| Auth, proxy, secret auth, settings | 2 |
| Shell, `components/`, `components/ui/` | glance (2) |
| Schemas, dates (`lib/schemas/`, `lib/dates.ts`) | glance (2) |

## Run log

| Run | Date | Base | Scope | New | Changed |
|---|---|---|---|---|---|
| 1 | 2026-10-03 | `1c2e601` | hot spots of the last 60 commits | AC-01 – AC-07 | — |
| — | 2026-10-03 | `6267b57` | re-check after #82 – #85 | — | AC-03 done; AC-01 merged into AC-02; AC-04 narrowed |
| 2 | 2026-10-03 | `6267b57` | every area run 1 did not read | AC-08, AC-09; parked AC-10, AC-11 | AC-02, AC-04, AC-06 widened; AC-07 promoted |
