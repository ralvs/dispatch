# Dispatch — domain glossary

Load-bearing terms used across the code and docs. One or two sentences each,
grounded in what the code actually does. See `CLAUDE.md` for the iron rules and
`docs/adr/` for the decisions behind them.

## capture

Frictionless intake of a raw thought — typed or pasted text, or text from a
webhook, watch, or shared link — into the system before it is understood.
Capture must never be lost (iron rule #4): the raw input is persisted first,
then parsed; any failure degrades to a `needs_review` note rather than
dropping the input. The raw firehose lands in `captured_data`; parsed text
turns into one or more actions (`lib/schemas/capture.ts`, `docs/adr/0008`).
Dispatch does not transcribe audio (docs/adr/0017).

## inbox

Where a **task** waits when it was captured without a domain. `createTask`'s
default is the only thing that ever puts one there (`INBOX_DOMAIN_ID`);
`assignDomain` gives it a real home and **refuses the Inbox as a target**, so
filing is one-way. UI route is **`/inbox`**; `/triage` — the name this queue
carried between ADR-0014 and ADR-0024 — permanently redirects. Today's alerts
row surfaces the count. The word "triage" is retired (docs/adr/0024).

## top-3

The (at most) three tasks starred as the day's priorities. Stored per-task as
`top3_for_date` (a calendar date, not a boolean), so a star is scoped to a
specific day; `toggleTop3` sets or clears it and `isTop3Today` tests it against
"today" in the app timezone. The Today page lists top-3 tasks ahead of merely
due/overdue ones.

## stewardship domain

A long-lived area of life Renan is responsible for — the seven seeded domains
are Engine, Health, Family, Spirituality, Finance, Code, Travel, plus the
system **Inbox** (`stewardship_domains`), which is flagged `is_system` and
carries none of the semantics below. Each carries a `fruit_definition`
(what "tended well" looks like) and `failure_patterns` (e.g. "no activity for N
days") that the observations cron reads to flag neglect. Every task belongs to
exactly one domain.

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

## day schedule

“When is my day” for **one date** — not necessarily today. Four bands:
**all-day** (all-day events + due tasks without time), **timeline** (timed
events interleaved with timed tasks, ordered by UTC instant so a spillover
event keeps its true place), **top 3**, and **open/unscheduled** tasks
(starred first, then already-due, capped at 10). Built by `buildDaySchedule`
in `lib/services/today.ts` — pure, so the partition and the sort are tested
without a database. See ADR-0014.

`DaySchedule` is the data only. Its UI is `DayView` (the region owning day
navigation and `?d=`), holding `DayTape` (ruler), `DayNav` (chevrons) and
`DayBands` (the four lists).

## Today vs Day

The prefix carries the date semantics (ADR-0036):

- **`Today*`** is locked to the real calendar today — `TodayView` (all the
  page's data), `TodayDigest` (its cold cached half: quotes, projects,
  routines, cadence, alert counts; tag `today-digest`).
- **`Day*`** follows the date picker, so it may be any date — `DaySchedule`,
  `DayView`, `DayBands`, `DayTape`, `DayNav`.

`briefing` and `chrome` are retired as domain terms; `chrome` means UI frame
again. **brief** is only the "In brief" cadence rows (`BriefLine`,
`BriefSection`) — one section, not the page.
