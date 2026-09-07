# Dispatch — domain glossary

Load-bearing terms used across the code and docs. One or two sentences each,
grounded in what the code actually does. See `docs/adr/0041-the-iron-rules.md`
for the iron rules and `docs/adr/` for the decisions behind them.

## capture

Frictionless intake of a raw thought — typed or pasted text, or text from a
webhook, watch, or shared link — into the system before it is understood.
Capture must never be lost (iron rule #4): the raw input is persisted first,
then parsed; any failure degrades to a `needs_review` note rather than
dropping the input. The raw firehose lands in `captured_data`; parsed text
turns into one or more actions (`lib/schemas/capture.ts`, `docs/adr/0008`).
A title-only create on `/tasks` is a separate **sentence → task** path
(`quickAddTask`) — no `captured_data`, no `needs_review` degrade
(docs/adr/0019 D3, 0043). Dispatch does not transcribe audio (docs/adr/0017).

## inbox

Where a **task** waits when it was captured without a domain — which is to say
`domain_id is null`, not a row of its own (ADR-0027). `createTask` simply
leaves the column unset when nothing named a domain; `assignDomain` gives the
task a real home, and since the Inbox is the absence of a domain there is
nothing to assign back to, so filing is one-way. UI route is **`/inbox`**; `/triage` — the name this queue
carried between ADR-0014 and ADR-0024 — permanently redirects. Today's alerts
row surfaces the count. The word "triage" is retired (docs/adr/0024).

## top-3

The (at most) three tasks starred as the day's priorities. Stored per-task as
`top3_for_date` (a calendar date, not a boolean), so a star is scoped to a
specific day; `toggleTop3` sets or clears it and `isTop3Today` tests it against
"today" in the app timezone. The Today page lists top-3 tasks ahead of merely
due/overdue ones.

## quiet project

A project whose `status` is anything other than `active` — `paused`, `done` or
`archived`. Its **undated** tasks stay out of Today and the default `/tasks`
views, out of the domain open-task count and out of the neglect sweep; a task
with a `due_date`, or with no project at all, is never quiet. `/projects`
labels the `paused` group "Quiet" (label only — the stored value is unchanged),
and `/tasks` keeps a filter chip to see them. The word "want", and the
`tasks.someday` column behind it, are retired (docs/adr/0057, 0058).

## stewardship domain

A long-lived area of life Renan is responsible for — the eight active domains
are Code, Engine, Family, Finance, Health, Home, Spirituality and Travel
(`stewardship_domains`). There is no Inbox row and no `is_system` column: an
unfiled task is one with `domain_id is null` (see **inbox**, and ADR-0027).
Each carries a `fruit_definition`
(what "tended well" looks like) and `failure_patterns` (e.g. "no activity for N
days") that the observations cron reads to flag neglect. A task belongs to at
most one domain; a task with none is in the **inbox**.

## needs_review

A boolean flag on a `notes` row marking content the system captured but could
not confidently place — the safety net for the never-lose-a-capture guarantee.
When parsing fails, input degrades to a note with `needs_review = true`
(indexed for quick retrieval) so nothing is dropped and the item can be
resolved by hand later.

## recurrence roll

How a recurring task advances instead of closing. Completing a task with a
`recurrence_rule` does not set it done — its `due_date` rolls forward to the
next occurrence (`completeTask` → `nextDueDate` in `lib/recurrence.ts`). The
roll is anchored so an overdue repeat moves to the next future date, never into
the past. Non-recurring tasks complete normally (`status = done`,
`completed_at` set).

## notification ledger

The record, in the `notifications` table, of every autonomous or external
action the system takes on Renan's behalf (iron rule #6). Writes go through
`lib/services/notifications.ts`, whose `recordNotification` is the single
sanctioned write path (it doesn't forbid a raw client from bypassing it).
Each row has a free-text `type`, a human `title`/`body`, an optional
`undo_payload`, and a `status` of `unread`, `read`, or `dismissed` (any of
which is reachable from any other). Web-push delivery (ADR-0005) is planned: it
will surface this same ledger to the phone.

## links (reading list)

Shared or API-posted **URLs** stored with title, description, and link, then
marked read. Primary nav label **Links** at **`/links`**; rows live in
`ingest_links` — the legacy table name, deliberately not migrated — with an
`unread`/`read`/`dismissed` status, written through `lib/services/links.ts`.
Title and description are fetched from the page by `lib/links/metadata.ts`,
best-effort. External senders POST to **`/api/capture`**, which routes a bare
URL here and everything else to the parser (`capture.link` ledger row).
A reading list of links, not the unfiled-task **inbox** at `/inbox`. See
ADR-0014, ADR-0022 and ADR-0024.

## mention

A **person** linked to a **task** or **note** because the person appears in
that item's text. Mentions are derived on text save (create/update of title,
notes, or body) — not on complete, star, pin, or delete — and live in the
`mentions` table with the verbatim `matched_name`. Notes may also carry plain
`@Name` matches from capture or paste; structured `@[uuid|Name]` remains the
editor form (docs/adr/0030). The graph is never allowed to fail a capture.

## day schedule

“When is my day” for **one date** — not necessarily today. Four bands:
**all-day** (all-day events + due tasks without time), **timeline** (timed
events interleaved with timed tasks, ordered by UTC instant so a spillover
event keeps its true place), **top 3**, and **open/unscheduled** tasks
(starred first, then already-due, capped at 10). **Day membership** — which
task or event sits in which band for that date — is one rule set, used both
when the day is first assembled and when the client projects an optimistic
tick (docs/adr/0038 keeps finished work on the day; a recurrence roll is the
one removal). See ADR-0014.

`DaySchedule` is the data only. Its UI is `DayView` — the region owning day
navigation and `?d=`, Today's page composition, and the one optimistic store
the bands share. It holds `DayNav` (the chevrons, which are the dateline
itself), `DayHeadline` (the sentence that follows the day), `DayTape` (the
proportional 06:00–22:00 measure, capped by the all-day band) and the three
band sections from `day-bands.tsx` — `Top3Section`, `TimelineSection`,
`OpenSection`. The all-day band has no section of its own: it belongs to the
tape, because together they are the whole day.

The store lives in `DayView` rather than the sections because Top 3 and the
Timeline sit in different columns and can hold the same task.

## Today vs Day

The prefix carries the date semantics (ADR-0036):

- **`Today*`** is locked to the real calendar today — `TodayView` (all the
  page's data), `TodayDigest` (its cold cached half: quotes, projects,
  routines, alert counts; tag `today-digest`).
- **`Day*`** follows the date picker, so it may be any date — `DaySchedule`,
  `DayView`, `DayHeadline`, `DayTape`, `DayNav`, and the band sections.

`briefing`, `chrome` and **brief** are all retired as domain terms; `chrome`
means UI frame again. The "In brief" section is gone — no `BriefLine` or
`CadenceLine` type, and no assembly, remains. Day* types live in
`lib/day-schedule.ts`, not the Today read.

## day tape

The proportional measure of one day at the top of Today: a pinned
**06:00–22:00** track where committed time is a filled block in its own
colour, free time is empty, and the now-mark carries its own hour. The window
only ever widens, and only to contain something outside it — a window that
fitted itself to the day's contents would make a 30-minute meeting a
different width every morning, and a proportion you cannot compare between
days measures nothing.

**Titles never go inside the blocks** (evidence:
`.impeccable/mocks/tape-lab.html`). Start times ride above the track on
desktop and go entirely on a phone; every title lives in the Timeline list
directly below. An **event** is a filled block spanning its duration; a
**scheduled task** is an outlined tick, because it is a point in time rather
than a span — the shape is what tells you which is which.

Colour is the domain's for a task and the **calendar's** for an event, since
a calendar event carries no domain (`lib/ui/event-color.ts`).
