# Ops shell, Today day schedule, link Ingest — execution plan

Output of the 2026-07-19 UI & architecture review (owner decisions locked).
**Execute after Phase 8 (PWA polish).** This is the next product pass: navigation
that matches daily use, a real day schedule on Today, and a first-class link
reading list (**Ingest**).

| | |
|--|--|
| **Status** | Planned — not started |
| **Decisions ADR** | [`docs/adr/0014-ops-shell-day-schedule-link-ingest.md`](./adr/0014-ops-shell-day-schedule-link-ingest.md) |
| **Review (why)** | [`docs/review-ui-architecture-2026-07-19.md`](./review-ui-architecture-2026-07-19.md) · [visual HTML](./review-ui-architecture-2026-07-19.html) |
| **Project status** | [`docs/status.html`](./status.html) |

Each numbered item is **independently committable** (Conventional Commits, one
logical commit per item unless noted). Run `bun run check` before every commit.
Author: `Renan Alves <renan@alves.id>`.

**Iron rules still apply:** UTC at boundary (`lib/dates.ts`), `requireOwner()`
first line on session surfaces, services take `sb` first, never lose a capture,
autonomous/external actions write `notifications`.

---

## Status

| # | Item | Status |
|---|------|--------|
| 0 | ADR-0014 | done (doc only) |
| 1 | Nav tiers + collapsible Library + mobile More | done |
| 2 | Task triage → `/triage` | done |
| 3 | `buildDaySchedule` pure helper + tests | done |
| 4 | Today: cadence, alerts, day schedule, mobile order | pending |
| 5 | Link Ingest schema + service | pending |
| 6 | Link Ingest page + mark read | pending |
| 7 | Link Ingest API + ledger + Today unread | pending |
| 8 | Capture chips → palette | pending |
| 9 | Settings: timezone + domain cadence threshold (P1) | pending |
| 10 | Docs / CONTEXT touch-up | pending |

Update this table as items land (commit hash optional).

---

## Locked product decisions (do not re-litigate)

1. **Nav Option A (ops-first):** Daily = Today · Tasks · Notes · **Ingest** · Chat;
   Library (collapsible) = Projects · Journal · Routines · Quotes · People;
   System = Notifications · Settings.
2. **Mobile tabs:** Today · Tasks · Notes · Ingest · **More**.
3. **Projects ↓** into Library; **Chat ↑** into Daily (desktop).
4. **Keep `/calendar` alias** — future page; Today is v1 calendar surface.
5. **Today day schedule:** all-day band + timeline mixing timed events + timed
   tasks + open/unscheduled bucket.
6. **Naming:**
   - Link reading list → **`/ingest`**, label **Ingest**
   - Task domain triage → **`/triage`**, label **Triage** (move from current `/inbox`)
   - System stewardship domain remains named **Inbox** in data (not a nav page)
   - Existing **`POST /api/ingest`** (text capture) **unchanged**; link API uses a
     different path (e.g. `/api/links`)

---

## 0. ADR on file — done

**Files:** `docs/adr/0014-ops-shell-day-schedule-link-ingest.md`

No code. Agents implement against ADR-0014 + this plan.

---

## 1. Nav tiers, collapsible Library, mobile More — Strong

**Files:** `components/nav-links.ts`, `components/desktop-rail.tsx`,
`components/bottom-tab-bar.tsx`, new `app/(authed)/more/page.tsx` (or sheet),
possibly a small `library-nav.tsx` client collapsible.

**Do:**

- Restructure `nav-links.ts` into explicit tiers:
  - `DAILY` / `LIBRARY` / `SYSTEM` (or equivalent exports).
  - Bottom `TABS` = Today, Tasks, Notes, Ingest, More (More → `/more`).
  - Keep Today aliases including **`/calendar`** (do not remove).
  - Tasks is a real primary item (not only an alias under Today).
  - Ingest primary href = `/ingest` (items 5–7 deliver the page).
  - Until Ingest ships, `/ingest` may 404 — **prefer shipping item 2 first** so
    triage is not stranded (see order below).
- Desktop rail: Daily links (serif/primary weight) → collapsible Library →
  System (mono) → footer (theme, email, sign out). Capture button stays.
- Library: collapsed by default is OK; persist open state in `localStorage` if
  cheap.
- Mobile: five tabs only; `/more` lists Library + System + Chat with the same
  links as the rail.

**Acceptance:**

- Desktop shows Projects under Library, Chat under Daily, Ingest under Daily.
- Mobile has no Settings tab; Settings reachable via More.
- `/calendar` still aliases Today active state.
- `bun run check` green.

**Commit sketch:** `feat(nav): ops-first tiers, collapsible library, more page`

---

## 2. Task triage → `/triage` — Strong (do before or with Ingest)

**Files:** `app/(authed)/inbox/*` → move/rename to `app/(authed)/triage/*`,
Today `inbox-strip.tsx` (rename to `triage-strip.tsx` if clearer), Tasks page
link, any `href="/inbox"` for **tasks**, `components/nav-links.ts` aliases.

**Do:**

- Move the existing task-triage page from `/inbox` to `/triage`.
- Rename UI chrome “Inbox” → “Triage” / “Awaiting triage” as appropriate
  (keep “Inbox” only when referring to the **system domain** name).
- Update Today strip: label **Triage**, href `/triage`.
- Update Tasks page “awaiting triage” link.
- Grep for `/inbox` task-triage usages; optional permanent redirect
  `/inbox` → `/triage` so old bookmarks work (link list is **`/ingest`**, not
  `/inbox`).

**Acceptance:**

- Visiting `/triage` shows the old unassigned-tasks UI.
- No primary nav item points task triage at `/inbox` or confuses it with Ingest.
- System domain still named Inbox in data/UI where domain name is shown.

**Commit sketch:** `refactor(triage): move task domain triage to /triage`

---

## 3. `buildDaySchedule` pure helper + tests — Strong

**Files:** `lib/services/briefing.ts`, `lib/services/briefing.test.ts`

**Do:**

- Add pure function (name can vary; document in module header):

  ```ts
  buildDaySchedule({
    events: CalendarEventRow[],
    openTasks: TaskRow[],
    todayIso: string,
    // optional: nowUtcIso for “past event” styling later
  }) → {
    allDay: DayScheduleItem[],
    timeline: DayScheduleItem[], // sorted ascending by time
    open: TaskRow[],             // unscheduled / not on timeline
  }
  ```

- **All day:** events with `all_day === true`; tasks with `due_date === todayIso`
  and no `due_time`.
- **Timeline:** events with `!all_day` for today + tasks with `due_date === todayIso`
  and a `due_time`. Sort by time (`due_time` / event start in app tz — use
  existing date helpers; **no raw `new Date()` calendar math**).
- **Open:** top-3 for today and other open tasks that were not placed in
  allDay/timeline (preserve top-3 ordering: top-3 first, then rest). Cap if
  needed (e.g. 10) consistent with current `assembleDoingToday` spirit.
- Wire into `getBriefing` return as `daySchedule` (keep existing fields until
  Today UI migrates so widget/chat do not break).
- Unit tests: empty day, all-day only, timed mix, task without time, stable sort
  when times equal (events before tasks or by title — pick one, document, test).

**Acceptance:**

- Tests cover partition + sort; no UI required in this commit.
- `assembleDoingToday` may remain for widget until item 4; do not silently
  change widget payload without checking `app/api/widget/route.ts`.

**Commit sketch:** `feat(briefing): buildDaySchedule all-day + mixed timeline`

---

## 4. Today page: cadence, alerts, day schedule, order — Strong

**Files:** `app/(authed)/today/page.tsx`, new components under
`app/(authed)/today/` (e.g. `cadence-strip.tsx`, `alerts-row.tsx`,
`day-schedule.tsx`, `timeline-row.tsx`), retire or thin `events-card.tsx` /
`doing-card.tsx` as the primary schedule (may keep as dead code one commit then
delete).

**Do:**

- **Cadence strip:** render `briefing.cadence` (already built). Links to tasks /
  routines / notes as today.
- **Alerts row:** triage count → `/triage`; needs-review count → `/notes`;
  placeholder or live unread for Ingest when item 7 lands.
- **Day schedule UI:** three bands per ADR-0014; event vs task kind badges;
  task rows reuse complete / top-3 actions (`TaskRowItem` or a slimmer timeline
  variant).
- **Mobile-first order** in the page tree (CSS grid can still be two-column on
  `lg`): masthead → cadence → alerts → day schedule → routines → in brief →
  projects → quotes → capture chips.
- Desktop: day schedule can span or sit in the main column; keep editorial
  two-column for brief/quotes vs side widgets if it still fits — prefer
  **schedule above the fold** on both breakpoints.
- Do **not** remove `/calendar` alias while touching nav.

**Acceptance:**

- Timed event and timed task appear on one timeline in clock order.
- All-day events are not mixed into the timed spine.
- Cadence visible when any cadence line is non-empty (and empty state OK when none).
- Manual: `bun dev`, Today with mixed fixtures or real CalDAV data.

**Commit sketch:** `feat(today): day schedule timeline and cadence strip`

---

## 5. Link Ingest — schema + service — Strong

**Files:** new `supabase/migrations/0006_ingest_links.sql` (number may vary —
next free), `lib/schemas/ingest-link.ts` (or similar),
`lib/services/ingest-links.ts` (+ tests), regenerate or hand-extend
`lib/database.types.ts` per project habit.

**Do:**

- Table e.g. `ingest_links`:
  - `id` uuid PK
  - `url` text not null
  - `title` text null
  - `description` text null
  - `status` text check in (`unread`, `read`, `dismissed`) default `unread`
  - `source` text null (e.g. `share_sheet`, `api`)
  - `created_at` / `updated_at` timestamptz UTC
  - owner RLS same pattern as other single-owner tables
- Service: `listItems`, `createItem`, `markRead`, `dismiss` (or mark status),
  `unreadCount` — all `(sb, …)` first arg; `unwrap` errors.
- Zod schemas as source of truth for inserts/rows.

**Acceptance:**

- Migration applies cleanly; service unit tests with stubs (same style as
  `notes.test.ts` / `notifications.test.ts`).
- No page required in this commit.

**Commit sketch:** `feat(ingest): schema and service for link reading list`

---

## 6. Link Ingest page at `/ingest` — Strong

**Depends on:** 2 (triage moved), 5 (service).

**Files:** `app/(authed)/ingest/page.tsx`, row component, `actions.ts`.

**Do:**

- List unread first, then read (or filter tabs).
- Each row: title (fallback hostname), description snippet, external link,
  mark read control.
- Empty state copy consistent with editorial tone.
- `requireOwnerPage()`; mutations via server actions calling the service.

**Acceptance:**

- Primary nav **Ingest** lands on this page.
- Mark read flips status and refreshes.
- Task triage is only on `/triage`.

**Commit sketch:** `feat(ingest): link reading list page`

---

## 7. Link Ingest API + ledger + Today unread — Strong

**Depends on:** 5, 6 (Today badge can land with 6 or here).

**Files:** e.g. `app/api/links/route.ts` (**not** a breaking change to
`app/api/ingest/route.ts` text capture), `lib/secret-auth.ts`, `lib/env.ts` if
a new secret is required (or reuse an existing webhook secret with a distinct
path — document choice in commit body), `lib/services/notifications.ts` caller,
Today alerts, widget optional.

**Do:**

- `POST` secret-authed body: `{ url, title?, description?, source? }`.
- Validate URL; insert via service-role admin client (same pattern as
  text `app/api/ingest/route.ts`).
- `recordNotification` on success (`type: "ingest.link"` or similar).
- Never run the LLM capture parser on this path for v1.
- Today alerts: show unread count → `/ingest`.

**Acceptance:**

- curl/script with secret creates a row visible in UI.
- Unauthorized → 401; invalid URL → 400.
- Notification ledger row present for successful ingest.
- Existing text `POST /api/ingest` still works unchanged.

**Commit sketch:** `feat(ingest): secret API for links and today badge`

---

## 8. Capture chips open the palette — Worth doing (P0/P1)

**Files:** `app/(authed)/today/capture-chips.tsx`, `lib/capture/palette-bus.ts`
(extend if kind hints needed).

**Do:**

- Chips call `openCapturePalette()` (optional prefill / kind hint) instead of
  only `Link` navigation. Secondary “open full page” can remain as a subtle
  control if useful.
- Keep accessibility (buttons, not fake links).

**Acceptance:**

- From Today, chip opens palette without full navigation away (or navigates
  only after explicit choice).

**Commit sketch:** `fix(today): capture chips open palette`

---

## 9. Settings polish (P1) — Worth doing after P0

**Files:** `app/(authed)/settings/*`, domain form/row, `lib/services/settings.ts`,
`lib/services/domains.ts`.

**Do:**

- Timezone editor wired to `updateAppTimezone` (select of common IANA zones or
  text input with validation).
- Domain cadence: UI for primary numeric rule (`no_activity_days` /
  `days_since_journal` value) writing `failure_patterns` so **In brief** is
  not seed-only.

**Acceptance:**

- Changing tz affects `todayInTz` boundaries for the owner.
- Setting N days causes domain to appear in In brief when past 75% threshold
  (see existing `deriveBriefLines` tests).

**Commit sketch:** `feat(settings): timezone editor and domain cadence rule`

---

## 10. Docs touch-up — Cheap

**Files:** `CONTEXT.md` (triage, ingest, day schedule), `docs/status.html`,
this file’s status table.

**Do:** Glossary + status only; no product code.

**Commit sketch:** `docs: ingest and day schedule glossary`

---

## Explicitly out of scope (this plan)

| Item | Notes |
|------|--------|
| Full `/calendar` page | Alias kept; build later (P2) |
| Mem.ai import | Former Phase 9 — still separate |
| Capture verbs (person, project, complete_routine) | Growth path ADR-0008 |
| Transcriber un-stub | Audio path later |
| People-to-contact on Today | P2 |
| Task list grouping/edit depth | P2 |
| Health/books | Cut (ADR-0011) — do not reintroduce |
| Renaming system **Inbox domain** | Stays “Inbox” in data |

---

## Suggested order

```
0 (done) → 2 → 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

Rationale:

- **2 before 1** clears `/inbox` semantics (redirect to triage) before Ingest
  is a primary tab.
- **3 before 4** so UI only binds tested pure helpers.
- **5 → 6 → 7** classic schema → UI → external API.
- **8–9** polish after the daily loop works.

Parallelism safe for agents: **3** can run in parallel with **2**; **5** can
start after **2** in parallel with **4**.

---

## Agent checklist (every item)

1. Read ADR-0014 + this item’s **Files** / **Do** / **Acceptance**.
2. Match existing patterns (`requireOwner`, `unwrap`, colocated `*.test.ts`,
   Biome tabs width 100).
3. `bun run check` before commit.
4. Conventional Commit; incremental; author as in `CLAUDE.md`.
5. Update **Status** table in this file when done.
6. New product decision that diverges → new ADR under `docs/adr/`.

---

## Quick reference — target nav

```
Desktop                          Mobile tabs
─────────────────────            ─────────────────────────
+ Capture  ⌘J                    Today · Tasks · Notes · Ingest · More

Daily
  Today
  Tasks
  Notes
  Ingest         → /ingest (links)
  Chat

Library ▾
  Projects
  Journal
  Routines
  Quotes
  People

System
  Notifications
  Settings
```

## Quick reference — Today stack

```
Masthead
Cadence strip          ← briefing.cadence
Alerts                 ← triage · needs_review · ingest unread
Day schedule
  All day              ← all-day events + due tasks w/o time
  Timeline             ← timed events ⟷ timed tasks
  Open / unscheduled   ← top-3 + other open
Routines
In brief
Projects (→ Library)
Quotes / journal
Capture chips          ← palette
```

## Quick reference — names

| Say | Mean |
|-----|------|
| **Ingest** | Link reading list UI + link API |
| **Triage** | Unassigned tasks → assign domain |
| **Inbox domain** | System stewardship domain in DB |
| **Text ingest** | Existing `POST /api/ingest` → `capture()` |
