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

## triage

Giving an unassigned **task** a real home. A task captured without a destination
lands in the system **Inbox domain** (`INBOX_DOMAIN_ID`); triage reassigns it
to a stewardship domain (`triageTask` in `lib/services/tasks.ts`). UI route is
**`/triage`** (moved from `/inbox` per ADR-0014; `/inbox` permanently redirects).
Today's alerts row surfaces the awaiting-triage count.

## top-3

The (at most) three tasks starred as the day's priorities. Stored per-task as
`top3_for_date` (a calendar date, not a boolean), so a star is scoped to a
specific day; `toggleTop3` sets or clears it and `isTop3Today` tests it against
"today" in the app timezone. The Today page lists top-3 tasks ahead of merely
due/overdue ones.

## stewardship domain

A long-lived area of life Renan is responsible for — the seven seeded domains
are Engine, Health, Family, Spirituality, Finance, Code, Travel, plus the
system **Inbox** (`stewardship_domains`). Each carries a `fruit_definition`
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

## ingest (link list)

Shared or API-posted **URLs** stored with title, description, and link, then
marked read. Primary nav label **Ingest** at **`/ingest`**; rows live in
`ingest_links` with a `unread`/`read`/`dismissed` status, written through
`lib/services/ingest-links.ts`. External senders POST to **`/api/links`**
(shared `CAPTURE_WEBHOOK_SECRET`, service-role insert, `ingest.link` ledger
row). Distinct from task **triage**, from the system **Inbox domain**, and from
text capture `POST /api/ingest` — that path runs the LLM parser, this one never
does. See ADR-0014.

## day schedule

Today’s “when is my day” composition: **all-day** band (all-day events + due
tasks without time), **timeline** (timed events interleaved with timed tasks,
ordered by UTC instant so a spillover event keeps its true place), and
**open/unscheduled** tasks (starred first, then already-due, capped at 10).
Built by `buildDaySchedule` in `lib/services/briefing.ts` — pure, so the
partition and the sort are tested without a database. See ADR-0014.
