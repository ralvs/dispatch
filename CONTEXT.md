# Dispatch — domain glossary

Load-bearing terms used across the code and docs. One or two sentences each,
grounded in what the code actually does. See `CLAUDE.md` for the iron rules and
`docs/adr/` for the decisions behind them.

## capture

Frictionless intake of a raw thought — typically a voice utterance, but also a
webhook, watch, or shared link — into the system before it is understood.
Capture must never be lost (iron rule #4): the raw input is persisted first,
then transcribed/parsed; any failure degrades to a `needs_review` note rather
than dropping the input. The raw firehose lands in `captured_data`; parsed
voice turns into one or more actions (`lib/schemas/capture.ts`, `docs/adr/0008`).

## triage

Giving a captured item a real home. A task captured without a destination
lands in the **Inbox** system domain (`INBOX_DOMAIN_ID`); triage reassigns it
to a stewardship domain (`triageTask` in `lib/services/tasks.ts`). The Today
page surfaces the count of "captures awaiting triage".

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
When transcription or parsing fails, input degrades to a note with
`needs_review = true` (indexed for quick retrieval) so nothing is dropped and
the item can be resolved by hand later.

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
`lib/services/notifications.ts`, whose `recordedAction` performs the mutation
and records it in one call — the sanctioned path that can't do the action
without leaving a trace (it doesn't forbid a raw client from bypassing it).
Each row has a free-text `type`, a human `title`/`body`, an optional
`undo_payload`, and a `status` of `unread`, `read`, or `dismissed` (any of
which is reachable from any other). Web-push delivery (ADR-0005) is planned: it
will surface this same ledger to the phone.
