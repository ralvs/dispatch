# Dispatch — domain glossary

Load-bearing terms used across the code and docs. One or two sentences each,
grounded in what the code actually does. See `docs/adr/0041-the-iron-rules.md`
for the iron rules and `docs/adr/` for the decisions behind them.

## capture

Frictionless intake of raw input — typed or pasted text, or text from a
webhook, watch, or shared link — into the system before it is understood.
Capture must never be lost (iron rule #4): the raw input is persisted first,
then parsed; any failure degrades to a `needs_review` note rather than
dropping the input. The raw firehose lands in `captured_data`; parsed text
turns into one or more actions (`lib/schemas/capture.ts`, `docs/adr/0008`).
A title-only create on `/tasks` is a separate **sentence → task** path
(`quickAddTask`) — no `captured_data`, no `needs_review` degrade
(docs/adr/0019 D3, 0043). Dispatch does not transcribe audio (docs/adr/0017).

## find

A command palette (⌘K) that locates a **task** or a **note** by substring.
Tasks are matched on `title` and `notes`; notes on `title` and `body`. Title
hits rank above body/notes hits. An empty query shows recents. Find does not
create anything and does not replace Chat (Ask). Quiet and done tasks still
appear — locating is not Today. Docs/adr/0059.

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
most one domain; a task with none is in the **inbox**. A task in a project is
always in that project's domain (docs/adr/0072).

## needs_review

A boolean flag on a `notes` row marking content the system captured but could
not confidently place — the safety net for the never-lose-a-capture guarantee.
When parsing fails, input degrades to a note with `needs_review = true`
(indexed for quick retrieval) so nothing is dropped and the item can be
resolved by hand later.

## next occurrence

How a recurring task carries on. Completing a task with a `recurrence_rule`
closes that row like any other (`status = done`, `completed_at` set) and
creates a new open row for the next occurrence, which takes the rule with it
(`completeTask` → `nextCompleteFields`, docs/adr/0059). So the day you ticked
it keeps a done row, and the series lives on exactly one open row. The next
date is anchored so an overdue repeat moves to the next future date, never
into the past. The older **recurrence roll** — one row whose `due_date` moved
forward — is retired.

## notification ledger

The record, in the `notifications` table, of every autonomous or external
action the system takes on Renan's behalf (iron rule #6). Writes go through
`lib/services/notifications.ts`, the single sanctioned write path (it doesn't
forbid a raw client from bypassing it). `recordNotification` is best-effort and
never rejects; `recordNotificationOrThrow` is for a row that is the delivery
itself, such as a fired reminder. Each row has a free-text `type`, a human
`title`/`body`, an optional `undo_payload`, and a `status` of `unread`, `read`,
or `dismissed` (any of which is reachable from any other). Once a row lands,
the module busts the ledger's cache tags and delivers it by web push
(ADR-0005), whoever the caller (docs/adr/0075).

## links (reading list)

Shared or API-posted **URLs** stored with title, description, and link, then
marked read. Primary nav label **Links** at **`/links`**; rows live in
`ingest_links` — the legacy table name, deliberately not migrated — with an
`unread`/`read`/`dismissed` status, written through `lib/services/links.ts`.
Title and description are fetched from the page by `lib/link-metadata.ts`,
best-effort. External senders POST to **`/api/capture`**, which routes a bare
URL here and everything else to the parser (`capture.link` ledger row).
A reading list of links, not the unfiled-task **inbox** at `/inbox`. See
ADR-0014, ADR-0022 and ADR-0024.

## MCP server

The tools an assistant such as Claude calls on Dispatch, at **`/api/mcp`**.
A client connects through OAuth: Supabase Auth issues it a token once the
owner approves it on `/oauth/consent`, and every tool then acts as the owner
through RLS. Each write records an `mcp.*` row in the **notification ledger**.
See docs/adr/0079.

## mention

A **person** linked to a **task** or **note** because the person appears in
that item's text. Mentions are derived on text save (create/update of title,
notes, or body) — not on complete, star, pin, or delete — and live in the
`mentions` table with the verbatim `matched_name`. Notes may also carry plain
`@Name` matches from capture or paste; structured `@[uuid|Name]` remains the
editor form (docs/adr/0030). The graph is never allowed to fail a capture.

## day schedule

“When is my day” for **one date** — not necessarily today. Four bands:
**all-day** (all-day events only), **timeline** (timed events interleaved
with timed tasks, ordered by UTC instant so a spillover event keeps its true
place), **top 3** (everything starred for the date), and **open** (the other
tasks due by the date and not on its timeline, capped at 10; finished ones
sink below). **Day
membership** — which task or event sits in which band for that date — is one
rule set, used both when the day is first assembled and when the client
re-places it after an intent (docs/adr/0038 keeps finished work on the day it
was finished). See ADR-0014.

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

## Memex

*Planned, not built (map #117).* The knowledge engine inside Dispatch, after
Karpathy's LLM Wiki. Renan's notes and tasks are its **sources**; Memex reads
them and never edits them. From them it compiles **thoughts**, which it owns.
It may *propose* a note or a task, and Renan accepts it. Code lives in
`memex/`, tables in the `memex` schema, and Dispatch never imports it.

## thought

*Planned (#120).* Memex's unit of knowledge: **one atomic statement**, in
English (docs/adr/0081), never a note. Echo's "AC cleaned in April, R$ 150,
every 6 months" is two thoughts: an event and a rule. A thought has a
**kind**:

- **event** — something happened on a date, with a precision of day, month
  or year, and an optional amount and currency. "Main bedroom AC cleaned in
  April 2026, R$ 150."
- **fact** — something that stays true. "Mother-in-law is Andrea."
- **rule** — something that repeats, with an interval, or a preference.
  "Main bedroom AC needs cleaning every 6 months."
- **insight** — a conclusion Memex draws across thoughts.

There is no task kind: tasks are Dispatch's.

A thought is created from at least one **source**: a note, a task, Renan's answer to a
question, a Chat answer, an Echo import, or an MCP capture. It is
**inferred** (Memex read it) or **confirmed** (Renan said or approved it). A
thought from Renan's answer is confirmed at once. Memex asks Renan only when
a thought matters, such as a cost or a rule, never to confirm everything.

Its meaning is never edited: a newer thought **supersedes** it, and the old
one stays as history. Only a typo fix edits in place, and it keeps the old
text as a version. An event that counts for a rule **fulfils** it: "AC
cleaned" fulfils "AC needs cleaning every 6 months", and "AC repaired" does
not. Memex decides this once, when it ingests the event, and stores the link.
"Last cleaned" is then the newest event that fulfils the rule. When Renan edits a source note, Memex
reads it again and may supersede the thought. When every source of a thought
is deleted, the thought stays, marked as having no source: a confirmed one is
kept, and for an inferred one Dream proposes removal. A thought Renan deletes
is hidden, not erased, and Memex does not write it again from the same
source.

## entity (Memex)

*Planned (#120).* A person, place or thing that thoughts are about ("Main
bedroom AC", "Andrea"). A proper name stays as written; a plain
description is English (docs/adr/0081). A rule and its events link to the
same entity. Thoughts link to entities, and that is the graph an agent walks.
Only two links join one thought to another: **supersedes** and **fulfils**
(an event to its rule). Everything else goes through entities and search. Memex extracts entities again from its thoughts; it does
not copy Echo's. Not the `people` table behind a **mention**.
