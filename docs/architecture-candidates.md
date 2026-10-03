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

1. **AC-02** — owns the intent → server-call pairing, and decides whether a
   form write's server half takes FormData or the intent. AC-06, AC-13 and
   AC-04 build on it.
2. **AC-08** — independent of AC-02; two live bugs (below). Can run beside it.
3. **AC-06** — the optimistic half of a create or edit is the form decode; it
   follows AC-02's choice of input.
4. **AC-07** — the read side of the store: stamp, snapshot, declared reads.
   After AC-02 settles what a write returns.
5. **AC-13** — the open note seeds its row; uses AC-02's note calls and
   AC-07's seeding.
6. **AC-14** — note file intake; after AC-13, which settles how the strip
   receives its write.
7. **AC-04** — counters travel in AC-07's snapshot aggregates; small by then.
8. **AC-09**, **AC-12**, **AC-05** — independent; any time. AC-05's prompt
   text must not change.

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
| Integration tests: a baseline reset and three client roles behind two calls | `test/integration/db.ts`, `test/integration/clients.ts` | run 3 |
| Navigation: one list feeds the tabs, the menu, the active mark and the shortcuts; links prefetch on intent | `components/nav-links.ts`, `components/intent-link.tsx` | run 3 |
| The migration check is pure behind a thin git wrapper | `scripts/check-migrations.ts` | run 3 |
| Deep already, leave alone: the store core, `capture()`'s never-lose boundary, the record kind factory, the capture palette machine, the CalDAV connection adapter, the mention parser, debounced save, the chat context render | `lib/store/core.ts`, `lib/services/capture/index.ts`, `lib/store/kinds/record.ts`, `lib/capture/machine.ts`, `lib/caldav/client.ts`, `lib/mentions.ts`, `lib/debounced-save.ts`, `lib/ai/chat-context.ts` | runs 1–2 |

## Open candidates

### AC-02 · Pair each intent with its server call once, per kind

- **Strength:** Strong · **Category:** in-process · **Found:** run 1 ·
  **Widened:** runs 2, 3, 4
- **Files:** `lib/store/run.ts` (`useRunIntent`, `useStoreWrite`),
  `components/ui/use-result-action.ts:25-42`,
  `app/(authed)/today/routines-card.tsx:84-87`,
  `app/(authed)/routines/routine-row.tsx:43-46`; the read-backs
  `lib/actions/routines.ts` (`writtenRoutine`), `lib/actions/tasks.ts:38`
  (`writtenRow`), `app/(authed)/notes/actions.ts:40` (`writtenNote`),
  `domains/actions.ts:37` (`writtenDomain`), `projects/[id]/actions.ts:30`
  (`writtenProject`), `people/[id]/actions.ts:48-49`,
  `app/api/notes/[id]/attachments/route.ts:71`; the inline-edit copies in
  `domain-row`, `project-detail`, `routine-row`, `person-detail` (lines 134,
  152, 351, 496), `note-editor`, `attachment-strip`.
- **Problem:** `useRunIntent(intent, action)` trusts each caller to make the
  optimistic half and the server half agree. `routines-card` sends the day in
  the intent but not to the action, so the server ticks its own today: after
  midnight, before the five-minute pull, the two disagree. A recurring tick
  splits the same way: the client counts the next occurrence from
  `opts.todayIso` (`lib/store/kinds/task.ts` `afterIntent`), the server dates
  it from `todayForRequest` (`lib/actions/tasks.ts:143`).
  `attachment-strip.tsx:100` passes a fake action
  (`async () => ({ ok: true, data: write })`). Failure → toast is written three
  ways (`useRunIntent`, `useStoreWrite`, `useResultAction`), the inline-edit
  handling is copied nine times, and each route writes its own read-back of
  the written row.
- **Direction:** each kind owns the server call for each of its intents, so a
  caller sends an intent and nothing else. The edit → error → close handling
  and the read-back of the written row sit behind the same interface. It also
  decides whether a form write's server half takes FormData or the intent.
- **Relations:** absorbs AC-01. Builds on the ADR-0069 shape. Constrains
  AC-06.

### AC-08 · An external action owns its ledger row, its delivery and its tags

- **Strength:** Strong · **Category:** ports & adapters (web push) ·
  **Found:** run 2 · **Widened:** runs 3, 4
- **Files:** `lib/services/notifications.ts:104-115` (`recordNotification`),
  `app/api/cron/sweep/route.ts:33-41`,
  `app/api/cron/observations/route.ts:35-43`,
  `app/api/capture/route.ts:102-114,133-144`,
  `app/api/calendar/bridge/route.ts:47-58`,
  `lib/services/capture/executor.ts:98-106`,
  `lib/invalidate.test.ts:233-294`,
  `supabase/migrations/20260714194155_schema.sql:857-864`.
- **Problem:** each caller wires three things by hand.
  - The ledger row is best-effort (ADR-0015) in capture, the bridge and the
    executor, which wrap it in `try`; the sweep and observations crons call it
    bare, so a ledger failure turns a committed sweep into a 500.
  - Each caller busts the ledger's tag itself; only source-grep tests hold it.
  - Whether a push goes out depends on the client passed in: "Only a
    service-role `sb` (cron/capture/autonomous callers) actually pushes". Every
    table's policy is `for all to authenticated using (true)`, and
    `push_subscriptions` has RLS on with no policy, so the client says nothing
    about ownership — only whether a push goes out. A palette capture that
    books an event (RLS client) records it and never pushes.
  - A failed bridge sync writes a ledger row
    (`app/api/calendar/bridge/route.ts:47-58`); a failed CalDAV sync writes
    only `caldav_sync_state` (`app/api/cron/caldav/route.ts:44-53`).
- **Direction:** one module owns "an autonomous or external action happened":
  the row, its delivery, and the ledger's tags. Who hears about an entry is
  that module's decision, not a side effect of RLS. The row is best-effort by
  default, and a caller can require it: a fired reminder's row *is* its
  delivery, so it must land before `markRemindersSent`
  (`lib/services/reminders.ts:60`, "duplicate over loss").
- **Relations:** touches AC-09 (who writes a failed sync's ledger row).
  Builds on `EXTERNAL_WRITES`.
  Touches iron rule #3 (push would stop depending on the caller's `sb`) and
  ADR-0001 (a service calling `next/cache`): decide both before the work.

### AC-06 · One form decode per entity, shared by the optimistic and the server half

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Widened:** runs 2, 3, 4
- **Files:** `app/(authed)/quotes/quote-form.tsx:36-39` vs
  `quotes/actions.ts:29-36`; `journal/actions.ts:24-31` (same `tagsFromForm`);
  `app/(authed)/projects/[id]/project-detail.tsx` (`projectPatch`, own date
  regex) vs `UpdateProjectSchema`; `lib/task-interaction/optimistic-task.ts`
  vs `CreateTaskFormSchema`; `routines/routine-row.tsx`, `routine-form.tsx`;
  `notes/actions.ts:72` vs `note-editor.tsx:146`;
  `components/title-only.ts:26` vs `components/task-fields.tsx:603`;
  `app/(authed)/people/[id]/actions.ts:45`.
- **Problem:** each entity decodes its form twice — by hand on the client,
  with Zod on the server — and nothing checks that they agree. `tagsFromForm`
  is copied in two actions and decoded a third time by hand; "a blank title is
  null" is written on both sides of notes; the default priority is hard-coded
  in `title-only.ts` and owned again by `PriorityPicker`.
  `lib/form-decode.ts` is client-safe but only actions use it. The server
  half's error contract varies: `updatePersonAction` and `createFactAction`
  decode outside `runFormAction`, so a validation error reaches the client as
  a generic failure (`createPersonAction` is right).
- **Direction:** the schema the action already parses with, through
  `lib/form-decode.ts`, also builds the optimistic row or patch.
- **Relations:** extends the `lib/form-decode.ts` shape. Constrained by
  AC-02: it follows AC-02's choice of what a form write's server half takes.

### AC-07 · A cached reader owns its stamp, its snapshot and its declared reads

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Promoted:** run 2 · **Widened:** run 3 (absorbs AC-11)
- **Files:** 14 `const readAt = nowUtc()` in 12 files under `lib/cache/`;
  15 pages with `const snapshot: Snapshot`; `lib/store/server.ts:9`
  (`stampRead`, one caller: `today/actions.ts:43`);
  `lib/cache/manifest.ts:23-30`;
  `lib/cache/notes.ts:99-113`; `lib/invalidate.test.ts:218-230`.
- **Problem:** the store's rule "stamp before the read" is held by hand in 14
  readers, which bypass the helper meant to own it. (The note page stamps
  after its read, but it seeds no view, so nothing visible changes — run 4.)
  Every page repeats the timezone,
  today and snapshot assembly. A reader's declared writes are checked one way
  only: each declared write must bust the tag, but nothing says the list is
  complete. `getCachedNoteLinks` and `getCachedTaskBoard` read `note_links`
  and do not list `notes.links`; they pass because it also busts `notes`.
- **Direction:** a cached reader returns a stamped snapshot and states what it
  reads in the terms the write side uses, so completeness is checked
  mechanically; a page only seeds it.
- **Relations:** builds on the ADR-0069 conflict rule. AC-04 and AC-13 depend
  on it.

### AC-13 · The open note reads its row from the store

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 3
- **Files:** `app/(authed)/notes/[id]/page.tsx:228-243`,
  `app/(authed)/notes/[id]/attachment-strip.tsx:98-101`,
  `app/(authed)/notes/[id]/note-editor.tsx:112-113`.
- **Problem:** the open note lives in three places: the server prop, the
  editor's `useState` copies (`note.domain_id`, `note.needs_review`), and the
  store row only `/notes` reads ("No view to seed"). Each write keeps the page
  fresh its own way: upload calls `router.refresh()`, filing and resolving
  move local state. `/projects/[id]` and `/people/[id]` already seed a view
  for their one row (`viewKey.projectHead(id)`, `viewKey.person(id)`).
- **Direction:** the note page seeds its row the way the project and person
  pages do; the editor, the attachment strip and the list read that one row.
- **Relations:** depends on AC-02 (the note kind's calls, including `touch`)
  and AC-07 (seeding). Builds on ADR-0069.

### AC-14 · Taking in a note file is one module

- **Strength:** Worth exploring · **Category:** local-substitutable (the
  storage port) · **Found:** run 3
- **Files:** `app/api/notes/[id]/attachments/route.ts:87-131` (`ingest`),
  `app/(authed)/notes/[id]/attachment-strip.tsx:37,98`, `lib/attachments.ts`,
  `lib/services/note-attachments.ts`, the route's test (eight `vi.mock`s).
- **Problem:** the intake rule — size, type, byte sniffing, downscale,
  partial batches — sits in the route; the strip restates the allow-list
  (`const ACCEPT = "image/*,application/pdf,.md,.txt,.markdown"`) and re-types
  the response body by hand (`body.write as StoreWrite<NoteListRow> | null`).
  The rule is only testable by mocking around the route.
- **Direction:** the note-files module owns accepting a file and the result
  shape; the route only translates HTTP. Tests use the storage port with a
  fake adapter.
- **Relations:** extends the settled note-files shape. After AC-13, which
  settles how the strip receives its write.

### AC-04 · Today's counters in one place, server and client

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 1
  · **Narrowed:** #82 · **Widened:** runs 2, 3, 4
- **Files:** `lib/services/today.ts:401-402`, `lib/store/kinds/task.ts:54`
  (`countsOf`), `app/(authed)/today/today-snapshots.ts:81-86`,
  `app/(authed)/projects/page.tsx:56`, `app/(authed)/projects/project-form.tsx:60`,
  `lib/services/observations.ts:195-200`, `lib/store/kinds/domain.ts:12`,
  `app/(authed)/notes/page.tsx:39`, `lib/services/notes.ts:254`.
- **Problem:** open, overdue and inbox are counted in `assembleTodayView` and
  again in `countsOf`. A project's done count has three sources, and /projects
  seeds `project.done` but never `project.open`. Each domain's open count is a
  fourth, and since the domain kind is a plain record kind, a tick never moves
  it. The review count has two server sources: the `/notes` list length and
  Today's `countNeedsReview`. "Routines done today" has three: a separate
  `listCompletionsOn` read and `completionHistory` inside
  `assembleTodayView` (`today.ts:280, 403-404, 430`), and the client's own in
  `routines-card.tsx:59-72`.
- **Direction:** one pure module says what a row adds to each counter; the
  server readers and the store adapters both use it.
- **Relations:** extends the `lib/quiet.ts` shape. Depends on AC-07 (counters
  travel in the snapshot's aggregates) and AC-02.

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
- **Relations:** touches AC-08: the mirror's failure state and the failed
  sync's ledger row are decided together.

### AC-12 · A row's columns are stated once and checked against the database

- **Strength:** Worth exploring · **Category:** in-process · **Found:** run 3
- **Files:** `lib/database.types.ts` (no importers), `lib/supabase/admin.ts`,
  `lib/schemas/note.ts:128` (`NOTE_LIST_SELECT`), `lib/services/notes.ts:84`;
  58 `as unknown as` casts in `lib/services/` and `lib/cache/` (8 in
  `people.ts`); unused `PersonSchema`, `PersonFactSchema`,
  `PersonInteractionSchema`, `UpdatePersonFactSchema`,
  `UpdatePersonInteractionSchema`.
- **Problem:** the generated database types are kept current and imported by
  nothing; the clients are untyped. Each `*RowSchema` is a Zod object nothing
  parses — it only yields a select string and a type — so a migration's
  columns are restated by hand and every service casts the result. Nothing
  checks the two agree, and dead schemas pile up.
- **Direction:** the generated types are what row shapes are checked against,
  through a typed client; select strings and row types still come from one
  place per entity, and the casts go.
- **Relations:** none with open candidates. Touches iron rule #3 (how `sb` is
  typed).

### AC-05 · The parser's interface shrinks to its entry points

- **Strength:** Worth exploring · **Category:** ports & adapters (AI gateway)
  · **Found:** run 1 · **Widened:** run 3
- **Files:** `lib/ai/parser.ts` (18 exports),
  `lib/services/capture/quick-add.ts:6-21` (`parseTaskCapture`),
  `scripts/parser-eval.ts:39-44,533,559`; tests `parser.test.ts`,
  `quick-add.test.ts`, `quick-add.int.test.ts`.
- **Problem:** the parser exports its prompt fragments, so quick-add and the
  eval script each rebuild the call skeleton (configured check,
  `generateObject`, title guard, failure log), and each test module-mocks `ai`
  and the gateway.
- **Direction:** the parser owns both prompt shapes and the call skeleton; the
  model call sits behind a seam with a gateway adapter and a fake adapter. The
  eval needs token usage, so the interface reports it.
- **Relations:** none. Prompt text is unchanged (ADR-0061); `bun run
  eval:parser` costs money and runs only with Renan's yes.

## Parked (speculative)

Kept so a later review does not rediscover them as new. Promote with evidence.

- **AC-10 · Derived graph edges reconcile once.** `syncMentions` copies
  `syncWikilinks`' reconcile ("mirrors syncWikilinks' full-reconcile shape"),
  the swallow-on-capture policy exists in `mentions.ts` (`withGraphFail`) and
  again in `notes.ts`, and NFD name folding is written three times
  (`lib/mentions.ts:34`, `capture/resolve.ts:44`, `capture/match.ts:51`,
  `lib/ai/verbatim.ts:27`). Two callers only. Run 2. Run 4: keep parked —
  each fold does something different after it, so a shared helper is one
  line, and the reconcile still has two callers.
- **Day state stored as placed bands.** Every reduce re-runs
  `collectDayTasks` → `placeOnDay`; `overflow` exists so the pool can be
  rebuilt (`lib/store/kinds/task.ts`, `lib/day-schedule.ts`). Run 1.

## Done

- **AC-03 · Capture returns the rows it wrote.** Done in #85 (ADR-0073).

## Merged and rejected

- **AC-01 · Task write module** → merged into AC-02. Its dialog half was done
  in #83; what is left (`bindTaskHandlers` with injected actions and hand
  intent → payload mapping) is AC-02 for the task kind.
- **AC-11 · A reader's declared writes are checked one way only** → merged
  into AC-07 (run 3): same readers, same question of what a reader owns.

## Side findings

Bugs a review saw that are not architecture. Fix and delete the line.

- `lib/ai/chat-context.ts:58` tells the model "Timezone is America/Sao_Paulo"
  although the function receives `tz` (iron rule #1). Run 2.
- **Removing a note file can delete another note's file.**
  `removeAttachment` (`lib/services/note-attachments.ts:74-86`) calls
  `note_attachment_remove`, which returns `void` and updates only the named
  note, then deletes `storagePath` from R2 regardless. A path that belongs to
  another note deletes that note's file and leaves it a dead thumbnail. The
  action's comment says the RPC "validates" the path; nothing reads a result.
  Run 3.
- An upload to a note id that does not exist stores the file, reports it
  attached, and returns `write: null`
  (`app/api/notes/[id]/attachments/route.ts`). Run 3.
- **Check the hosted project's sign-ups.** `supabase/config.toml:176` has
  `enable_signup = true` locally, and every table's policy lets any
  authenticated user read and write. If hosted sign-ups are on, anyone can
  make an account and reach the data through PostgREST. Run 3.
- `proxy.ts:4-13` copies the auth cookie options because it "cannot import"
  `lib/supabase/cookie-options.ts`; that file now imports only a type from
  `@supabase/ssr`, which the proxy already imports. Run 3.
- `TodayView.routineBuckets` (`lib/services/today.ts:94,430`) is computed and
  read by nothing; the card reads the store. The re-export at `today.ts:186`
  has no importers, and `lib/routine-buckets.ts:1-3` still says it is
  re-exported for the widget and chat. Run 4.
- `listCompletionsOn(sb, todayIso)` (`today.ts:280`) re-reads what
  `listCompletionsSince(...)` (`today.ts:286`) already returns: one extra query
  on Today, `/api/widget` and `/api/chat`. Run 4.
- Calendar math outside `lib/dates.ts` (iron rule #1): `Date.UTC` in
  `lib/routine-stats.ts:61-86,164`, and `observations.ts:59-66` copies
  `calendarDaysBetween`. Correct today; move it. Run 4.

## Coverage

Which areas each run read closely. A review reads the empty rows first.

| Area | Runs |
|---|---|
| Entity store (`lib/store/`) | 1 |
| Task intents, day schedule (`lib/task-interaction/`, `lib/day-schedule.ts`) | 1 |
| Tasks UI, task dialog, task actions | 1 |
| Capture (`lib/services/capture/`, `lib/ai/`, `lib/capture/`, `app/api/capture`) | 1 |
| Today (`lib/services/today.ts`, `app/(authed)/today/`) | 1, 4 (tick flow) |
| Projects, domains | 1 |
| Notes, note links, attachments, R2 (`lib/storage/`) | 2, 3 (end to end) |
| People, mentions | 2 |
| Routines | 2 |
| Links, quotes, journal | 2 |
| Notifications, push | 2, 4 (every ledger caller) |
| Calendar, CalDAV, reminders sync | 2 |
| Crons, observations (`app/api/cron/`) | 2 |
| Find, chat | 2 |
| Cache readers, invalidation (`lib/cache/`, `lib/invalidate.ts`) | 2 |
| Auth, proxy, secret auth, settings | 2, 3 |
| Shell, `components/`, `components/ui/` | 3, 4 |
| Schemas (`lib/schemas/`) | 3 |
| Dates and flat `lib/*.ts` | 4 |
| Test harness, `scripts/` | 3 |
| Migrations, RLS, triggers (`supabase/`) | 3 |
| Other external routes (`app/api/media`, `notes`, `push`, `widget`, `chat`) | 3 |
| `proxy.ts`, `next.config.ts` | 3 |

## Run log

| Run | Date | Base | Scope | New | Changed |
|---|---|---|---|---|---|
| 1 | 2026-10-03 | `1c2e601` | hot spots of the last 60 commits | AC-01 – AC-07 | — |
| — | 2026-10-03 | `6267b57` | re-check after #82 – #85 | — | AC-03 done; AC-01 merged into AC-02; AC-04 narrowed |
| 2 | 2026-10-03 | `6267b57` | every area run 1 did not read | AC-08, AC-09; parked AC-10, AC-11 | AC-02, AC-04, AC-06 widened; AC-07 promoted |
| 3 | 2026-10-03 | `6267b57` | glanced areas, tests, migrations, other routes; notes end to end; file consistency | AC-12, AC-13, AC-14 | AC-11 merged into AC-07; AC-02, AC-04, AC-05, AC-06, AC-08 widened; work order re-cut |
| 4 | 2026-10-03 | `6267b57` | convergence: a tick end to end, flat `lib/`, `components/ui/`; adversarial pass on every open item | none | AC-02, AC-04, AC-06, AC-08 widened; AC-07 narrowed; AC-09 relation added; AC-10 kept parked |
