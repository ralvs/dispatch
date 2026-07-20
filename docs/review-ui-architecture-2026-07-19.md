# Dispatch — UI & Architecture Review (revised)

**Date:** 2026-07-19  
**Status:** Decisions locked for a formal plan (not yet implementation)  
**Visual companion:** [`review-ui-architecture-2026-07-19.html`](./review-ui-architecture-2026-07-19.html)

---

## Decisions locked

| Decision | Choice |
|----------|--------|
| Nav IA | **Option A (ops-first)**, with the refinements below |
| Projects | Move from primary → **Library** (collapsible) |
| Chat | Move from Library → **Daily** (primary tier) |
| Library | **Collapsible / hideable** as a group |
| `/calendar` | **Keep** alias (future page OK); Today must surface events well now |
| Today schedule | **All-day band** + **timed timeline** that **mixes tasks and events** |
| Ingest / reading inbox | **Missing product surface** — must be planned (see below) |

---

## Navigation (decided)

### Desktop rail

```
DISPATCH
[+ Capture          ⌘J]

── Daily ────────────────
Today
Tasks
Notes
Inbox          ← link/read-later ingest (new surface)
Chat           ← promoted from Library

── Library (collapsible) ─
Projects       ← demoted from primary tabs
Journal
Routines
Quotes
People

── System ───────────────
Notifications
Settings

theme · email · sign out
```

### Mobile bottom bar

`Today · Tasks · Notes · Inbox · More`

- **More** opens Library + System destinations (and any rail extras).
- Library section is collapsible on desktop; collapsed-by-default is acceptable.

### Aliases (`nav-links.ts`)

| Item | Aliases / notes |
|------|-----------------|
| Today | `/tasks` remains a sibling destination but **Tasks is also a primary link**; keep `/calendar` for future page |
| Inbox | New primary route for **link ingest / read-later** (see distinction below) |
| Settings | Notifications may stay system-tier, not Settings-active alias if confusing |

### Task triage vs link Inbox

There are **two different “inbox” concepts** in the product vocabulary:

| Concept | Route today | Purpose |
|---------|-------------|---------|
| **Task triage** | `/inbox` | Open tasks in the system Inbox domain — assign a stewardship domain |
| **Link / reading inbox** | **missing UI** | Shared URL (API) → title / description / link → mark as read |

**Plan requirement:** do not overload names. Prefer:

- Keep task triage as **Triage** or **Unassigned** (or under Tasks), **or**
- Call the new surface **Ingest** / **Reading** / **Links**, and reserve **Inbox** for one of them only.

User intent for the new page: *accept a URL via API, store title + description + link, list them, mark as read.*

What exists today:

- `POST /api/ingest` — text capture pipeline (voice/watch/share → `capture()`), not a dedicated link-reading list UI.
- `/inbox` — task triage only.
- Schema/comments mention loose ingest payloads and “link share”, but **no first-class reading-inbox page**.

---

## Today page (decided)

### Goals

1. **Calendar events must show clearly** on Today (CalDAV data already lands in briefing; presentation is the gap).
2. **Clear separation** between **all-day** and **timed** items.
3. A single **timeline** that **interleaves timed events and timed tasks** (by start / due time).
4. Keep existing briefing pieces (masthead, cadence, inbox strips, routines, projects-in-library context, quotes) but restructure the **day schedule** block.

### Proposed Today structure

```
Masthead
Cadence strip                    ← wire existing briefing.cadence
Anchor (optional, shorter)
Alerts: task-triage count · needs-review · unread link-inbox

┌─ Day schedule ─────────────────────────────────────┐
│  ALL DAY                                           │
│    · all-day calendar events                       │
│    · tasks due today with no due_time (optional)   │
│                                                    │
│  TIMELINE  (sorted by time)                        │
│    09:00  Event  Team standup                      │
│    10:30  Task   Ship review notes          ★      │
│    14:00  Event  Dentist                           │
│    16:00  Task   Call bank                         │
│                                                    │
│  OPEN / UNSCHEDULED (if not in all-day)            │
│    · top-3 + open tasks without time               │
└────────────────────────────────────────────────────┘

Routines
In brief (domain cadence)
Projects strip (link into Library)
Quotes / journal prompt
Capture chips → open palette
```

### Separation rules (plan-level)

| Bucket | Includes |
|--------|----------|
| **All day** | `calendar_events.all_day === true` for today; optionally tasks with `due_date = today` and **no** `due_time` |
| **Timeline** | Timed events (`!all_day`) + tasks with `due_date = today` (or overdue carry?) **and** `due_time` set — merged, sorted by time |
| **Unscheduled / open** | Top-3 and other open/due tasks that are not on the timeline (no time, or not due today) |

Star (top-3) and complete/checkbox remain on task rows inside the timeline.

### Calendar

- **Keep** `/calendar` nav alias for a future dedicated page.
- **Do not block** on building full calendar UI: Today’s day schedule is the v1 calendar surface.
- Events already come from `getBriefing().todayEvents` / `EventsCard` — replace flat list with all-day + timeline composition.

### Mobile order (action-first)

1. Masthead + cadence  
2. Alerts (triage / needs-review / link-inbox)  
3. **Day schedule** (all-day + timeline)  
4. Routines  
5. In brief / projects  
6. Journal + quotes  
7. Capture chips  

---

## Still missing / improve (unchanged priorities)

### P0 (with decisions applied)

1. Nav Option A + Library collapsible + Chat up + Projects down + **Inbox/Ingest primary**  
2. Today **day schedule**: all-day band + mixed task/event timeline  
3. Render **cadence strip** (data already exists)  
4. **Needs-review** strip on Today  
5. Surface **link-inbox unread** count when that page exists  

### P1

6. Capture chips → palette  
7. Editable domain cadence threshold  
8. Journal-today widget  
9. Timezone editor in Settings  
10. Link-ingest API contract + mark-as-read service (if not already sufficient)  

### P2

11. Full `/calendar` page  
12. Task list grouping depth  
13. People-to-contact  
14. Capture verb growth  
15. Docs / status.html refresh  

---

## Architecture notes (for the formal plan)

- **Briefing view model** should grow a `daySchedule` (or pure helper) that partitions events + tasks into `allDay[]` and `timeline[]` — unit-test the merge sort (timezone-safe via existing `lib/dates.ts`).
- **Do not remove** `/calendar` alias.
- **Link inbox** is a new product surface: route + service + API shape (URL → title/description/link → read state). Distinguish from task triage in naming and nav.
- Service layer, capture never-lose, UTC boundary: **keep**.

---

## Open naming choice (one decision left for the plan)

Only naming remains ambiguous:

1. **Inbox** = link reading list; rename task triage to **Triage**  
2. **Inbox** = task triage (current); new page = **Ingest** / **Reading** / **Links**

Recommendation for plan draft: **(2) Ingest** for the URL surface if share-sheet language matters; **(1) Inbox** if the primary mental model is “things to process that aren’t tasks yet.”
