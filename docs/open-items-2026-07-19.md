# Open items — everything not done, as of 2026-07-19

Written after the ops-shell plan ([`ui-ops-shell-2026-07-19.md`](./ui-ops-shell-2026-07-19.md))
shipped in full. This is the complete inventory of what the ADRs and plans
still leave open, so the next session can start from a list rather than a
grep. It is **not** a plan — nothing here is scheduled, and several entries
are deliberate non-work.

| | |
|--|--|
| **Covers** | `docs/adr/0001`–`0016`, both execution plans, `CONTEXT.md`, `CLAUDE.md` |
| **Closed plans** | [`architecture-fixes-2026-07-15.md`](./architecture-fixes-2026-07-15.md) (fully executed) · [`ui-ops-shell-2026-07-19.md`](./ui-ops-shell-2026-07-19.md) (fully executed) |
| **Open plan** | [`capture-vocabulary-2026-07-20.md`](./capture-vocabulary-2026-07-20.md) — planned, not started; supersedes section 2 below |
| **Status page** | [`status.html`](./status.html) |

---

## 1. Feature work not started

| # | Item | Source | Notes |
|---|------|--------|-------|
| 1.1 | **Mem.ai import** — one-time migration of the existing corpus, then retire Mem | Phase 9 | `MEM_API_KEY` is already in `lib/env.ts`. The only major phase outstanding. |
| 1.2 | **Full `/calendar` page** | ADR-0014, plan P2 | The nav alias is kept on purpose and `/calendar` **404s today**. Today is the v1 calendar surface. |
| 1.3 | **People-to-contact on Today** | plan P2 | |
| 1.4 | **Task list grouping / edit depth** | plan P2 | |

## 2. Capture vocabulary still deferred (ADR-0008) — now planned, not just deferred

Every one of these is a growth-path verb the parser is not allowed to emit,
because there is no executor behind it. The v1 vocabulary is `create_task` /
`create_note` / `create_quote` / `create_journal_entry` / `needs_review`.

As of 2026-07-20 this whole section has a plan:
[`capture-vocabulary-2026-07-20.md`](./capture-vocabulary-2026-07-20.md), with
ambiguity settled in
[ADR-0016](./adr/0016-capture-vocabulary-growth-and-audio-transcription.md)
(ambiguous entity → `needs_review`, no picker). Audio transcription was
planned then **cut** — [ADR-0017](./adr/0017-no-in-app-audio-transcription.md).
The table below is a quick index; the plan is the executable version.

| # | Item | Notes |
|---|------|-------|
| 2.1 | ~~**Audio transcription**~~ | **Cut** (ADR-0017). Plan items 6–8 cancelled. |
| 2.2 | **`complete_task`** and every entity-resolution verb | Plan items 1–3 (`lib/services/capture/match.ts`, parser context). |
| 2.3 | **Project / person executors** | `create_project`, `update_project_status`, `create_person_fact` — plan item 4. `log_activity` and `update_milestone` stay out of scope (no service / needs double resolution — see the plan's out-of-scope table). |
| 2.4 | **`needs_disambiguation` flow** | Decided **not** to build a picker (ADR-0016 Decision 1) — plan item 5 folds ambiguity into `needs_review` instead. |

## 3. Decisions taken, with a named trigger to revisit

Not work — recorded positions. Do not "fix" these without the trigger.

| # | Position | Revisit when |
|---|----------|--------------|
| 3.1 | **External write paths keep a best-effort ledger, no atomic RPC, no idempotency key** (ADR-0015) | A sender that retries on its own schedule starts posting, or something automated reads the ledger to decide whether work already ran. |
| 3.2 | **`recordNotification` is the blessed path, not a hard boundary** — anything holding a `SupabaseClient` can bypass it | An import-boundary lint is deferred "until there are callers to protect" (`lib/services/notifications.ts`). |
| 3.3 | **Health / books stay cut** (ADR-0011) | Never, per the plan's out-of-scope table. Do not reintroduce. |
| 3.4 | **System stewardship domain stays named "Inbox" in data** (ADR-0014) | Never. `/triage` is the UI, `/ingest` is the link list. |
| 3.5 | **`assembleDoingToday` survives alongside `buildDaySchedule`** | It feeds the widget payload and chat context; Today reads `daySchedule`. Retire it when those two callers migrate. |

## 4. Verification debt from the ops-shell plan — closed 2026-07-20

Closed with the owner's authorization to write reversible seed data and run
one real capture against the live project. What each check actually showed:

| # | Verified | Result |
|---|----------|--------|
| 4.1 | Timed event + timed task rendering on one timeline | Seeded 3 `calendar_events` (`created_here`, deleted after) plus the already-due-today task. All-day band and timeline separated correctly; a 09:00 event and a 09:00 task tied and broke events-first, matching the documented rule. |
| 4.2 | Changing the timezone moves `todayInTz` boundaries | Flipped `app_settings.timezone` to `Europe/London` via the real Settings form. Both events' displayed times shifted (09:00→13:00, 18:00→22:00); the task stayed at 09:00 because `due_time` is wall-clock local, resolved through `instantFromLocal` — so it re-sorted to first place. Confirms the timeline orders on resolved UTC instants, not displayed strings. Reverted to `America/Sao_Paulo`. |
| 4.3 | Setting N days puts a domain into "In brief" past 75% | Set Travel's cadence to 5 days via the real domain edit form (was 60, `days since` was 6). Travel appeared in "In brief", sorted by slip ratio, rule name (`no_activity_days`) preserved. Reverted to 60. |
| 4.4 | `POST /api/ingest` end-to-end after the ops-shell changes | Real webhook call, real LLM parser run. Outcome: the parser routed it to a `needs_review` note rather than a task — itself a useful path to have seen work. Confirmed the raw `captured_data` row persisted before the parse (iron rule #4), the `notes` row landed tagged `capture:needs_review`, the `ingest.captured` ledger row was written, and Today's cadence strip + alerts row both picked up the live `needsReviewCount`. Left in place — see 5.4. |

All four now have live evidence, not just unit coverage. The unit tests listed
in the previous revision of this section still stand and still run in CI;
this table records what watching it work actually showed.

## 5. Housekeeping

| # | Item | Notes |
|---|------|-------|
| 5.1 | **Seeded "Link Inbox" note is vestigial** | Row `7d1f6a2e-…` from migration `0001`, a markdown note shared links were once meant to append to. ADR-0014 replaced the design with `ingest_links`. Left in place — it is the owner's data, not the system's. |
| 5.2 | **Two test links sit in the reading pile** | `nextjs.org/docs` and `example.com/hello`, created while verifying `POST /api/links`, with their two `ingest.link` ledger rows. Dismissing them at `/ingest` is the intended cleanup. |
| 5.3 | **The 2026-07-19 review doc is point-in-time** | [`review-ui-architecture-2026-07-19.md`](./review-ui-architecture-2026-07-19.md) still says triage is "today still `/inbox`". Kept as a dated record of the argument, not corrected. |
| 5.4 | **One real capture sits in Notes and the ledger** | Created while closing 4.4: a `needs_review` note ("Verification capture 2026-07-20…", tagged `capture:needs_review`), its `captured_data` row, and one `ingest.captured` notification. Left in place — same call as 5.2; resolve or delete it at `/notes` whenever it's convenient. |

---

## What is genuinely finished

So the next reader does not go looking: both execution plans are fully
executed, all ten ops-shell items shipped one commit each, the reconciliation
sweep cron exists, external ingest exists, web push is delivered inside
`recordNotification`, and migration `0006` is applied to the project. ADR-0008's
Deferred list and `lib/services/notifications.ts` both carried stale claims to
the contrary until 2026-07-19; both now say what is true.
