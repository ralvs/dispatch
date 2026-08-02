# Ops-first shell, Today day schedule, and link Ingest

Date: 2026-07-19

> **Renamed (2026-08-02).** The day schedule's UI is now `DayView` (region),
> `DayBands` (the four lists), `DayTape`, `DayNav`; `DaySchedule` is the data
> type only. See
> [ADR-0036](./0036-today-is-locked-day-follows-the-picker.md). Decisions
> below stand; wording is left as written.

## Context

After Phase 8 (PWA polish) the product works end-to-end, but daily use
still feels unfinished: the rail treats Settings and People like first-class
ops destinations; Projects sits in the primary five while Chat and Journal
are desktop-only extras; Today loads calendar events and cadence data but
renders a flat events list and a separate task card; and there is no first-class
surface for shared URLs (title / description / link → mark as read).

The owner locked decisions in the 2026-07-19 UI review
(`docs/review-ui-architecture-2026-07-19.md` + `.html`). This ADR records
those product decisions. The executable work breakdown is
`docs/ui-ops-shell-2026-07-19.md`.

## Decision

### 1. Ops-first navigation (Option A, refined)

Desktop rail has three tiers:

| Tier | Items | Notes |
|------|--------|--------|
| **Daily** | Today, Tasks, Notes, **Ingest** (link reading), Chat | Primary ops |
| **Library** | Projects, Journal, Routines, Quotes, People | **Collapsible** as a group |
| **System** | Notifications, Settings | Footer-adjacent, mono |

Mobile bottom bar: **Today · Tasks · Notes · Ingest · More**.  
More hosts Library + System + Chat (Chat is Daily on desktop; More on mobile is fine).

- **Projects** leave the primary five and live under Library.
- **Chat** leaves `RAIL_EXTRAS`-only and joins Daily (desktop).
- **`/calendar` alias is kept** for a future dedicated page. Today is the v1
  calendar surface (events in the day schedule). Do not delete the alias.

### 2. Naming: Ingest vs Triage vs system Inbox domain

Three different concepts — do not collapse labels:

| Product | Route | Label |
|---------|--------|--------|
| **Link / reading list** | `/ingest` | **Ingest** (primary nav) |
| **Task domain triage** | `/triage` | **Triage** |
| **System stewardship domain** | (data only) | **Inbox** domain — unassigned tasks; not a nav page |

Today’s existing task-triage page at `/inbox` **moves to `/triage`**. All call
sites (Today strip, Tasks page link) update in the same change set. After the
move, `/inbox` should redirect to `/triage` (or 404) — it is **not** the link
reading list.

**Do not overload** the existing text-capture webhook `POST /api/ingest`
(watch / free-text → `capture()`). Link share uses a **distinct API path**
(e.g. `POST /api/links` or `POST /api/ingest/links`) so agents do not break
Phase 7 ingest.

### 3. Today day schedule

Replace the separate flat **Events** card + **Doing** card as the “when is my
day” story with one **Day schedule**:

1. **All day** — `calendar_events` with `all_day` for today; tasks due today
   with no `due_time`.
2. **Timeline** — timed events (`!all_day`) and tasks with `due_date` +
   `due_time`, **merged and sorted by clock time**, kind-badged (event vs task).
   Task rows keep complete + top-3 star.
3. **Open / unscheduled** — top-3 and other open tasks not placed on the
   timeline (no time, or not due today as applicable).

Cadence strip (`buildCadenceLines` — already computed, used by widget/chat)
**must render** on Today. Alerts row: triage count, needs-review count, unread
ingest count (once Ingest ships).

Mobile stacks **action-first**: masthead → cadence → alerts → day schedule →
routines → in brief / projects / quotes → capture chips.

### 4. Link Ingest (new record kind)

A dedicated **reading / share list**:

- Ingest via secret-authed HTTP API (share sheet / shortcut): URL plus optional
  title and description.
- Persist title, description, link, read/unread (and created_at).
- UI list at `/ingest` with mark-as-read (and dismiss/archive if trivial).
- Every successful external link ingest writes a `notifications` ledger row
  (iron rule #6).
- Distinct from `POST /api/ingest` text-capture. Capture pipeline stays for
  free-text; link Ingest is a separate write path that never runs the LLM
  parser on bare URLs unless we later choose to.

Schema: prefer a small purpose-built table (e.g. `ingest_links` or
`link_ingest_items`) over overloading `notes` or `captured_data`, unless
inventory during implementation shows an existing table already matches.
Service takes `sb` first; pages use `requireOwner()`.

## Consequences

- `components/nav-links.ts` and rail/tab components become tier-aware;
  Library needs a collapsible client control; mobile needs a **More** route or
  sheet.
- `lib/services/briefing.ts` gains pure `buildDaySchedule` (tested); Today
  components recompose around it. Keep `/calendar` alias.
- Task triage path rename is a mechanical but must-not-miss link sweep.
- New migration + service + page + API for link Ingest; ADR-0008 capture path
  is **not** rewritten; text `POST /api/ingest` keeps its contract.
- Implementation order and acceptance criteria live in
  `docs/ui-ops-shell-2026-07-19.md` — execute that plan, not this ADR alone.

## Supersedes draft naming

An earlier draft of this ADR used “Inbox” for the link list. Owner preference:
**Ingest** for links, **Triage** for unassigned tasks. Filename on disk:
`0014-ops-shell-day-schedule-link-ingest.md`.
