# Open items — everything not done, as of 2026-07-19

Written after the ops-shell plan ([`ui-ops-shell-2026-07-19.md`](./ui-ops-shell-2026-07-19.md))
shipped in full. This is the complete inventory of what the ADRs and plans
still leave open, so the next session can start from a list rather than a
grep. It is **not** a plan — nothing here is scheduled, and several entries
are deliberate non-work.

| | |
|--|--|
| **Covers** | `docs/adr/0001`–`0015`, both execution plans, `CONTEXT.md`, `CLAUDE.md` |
| **Closed plans** | [`architecture-fixes-2026-07-15.md`](./architecture-fixes-2026-07-15.md) (fully executed) · [`ui-ops-shell-2026-07-19.md`](./ui-ops-shell-2026-07-19.md) (fully executed) |
| **Status page** | [`status.html`](./status.html) |

---

## 1. Feature work not started

| # | Item | Source | Notes |
|---|------|--------|-------|
| 1.1 | **Mem.ai import** — one-time migration of the existing corpus, then retire Mem | Phase 9 | `MEM_API_KEY` is already in `lib/env.ts`. The only major phase outstanding. |
| 1.2 | **Full `/calendar` page** | ADR-0014, plan P2 | The nav alias is kept on purpose and `/calendar` **404s today**. Today is the v1 calendar surface. |
| 1.3 | **People-to-contact on Today** | plan P2 | |
| 1.4 | **Task list grouping / edit depth** | plan P2 | |

## 2. Capture vocabulary still deferred (ADR-0008)

Every one of these is a growth-path verb the parser is not allowed to emit,
because there is no executor behind it. The v1 vocabulary is `create_task` /
`create_note` / `create_quote` / `create_journal_entry` / `needs_review`.

| # | Item | Notes |
|---|------|-------|
| 2.1 | **Audio transcription** | `lib/ai/transcriber.ts` is a stub returning `unavailable`; the palette sends text. Un-stubbing is the whole audio path. |
| 2.2 | **`complete_task`** and every entity-resolution verb | Needs resolution against existing rows, which is why they were cut. |
| 2.3 | **Project / person executors** | Quote, journal landed. |
| 2.4 | **`needs_disambiguation` flow** | Today everything ambiguous degrades to `needs_review`. |

## 3. Decisions taken, with a named trigger to revisit

Not work — recorded positions. Do not "fix" these without the trigger.

| # | Position | Revisit when |
|---|----------|--------------|
| 3.1 | **External write paths keep a best-effort ledger, no atomic RPC, no idempotency key** (ADR-0015) | A sender that retries on its own schedule starts posting, or something automated reads the ledger to decide whether work already ran. |
| 3.2 | **`recordNotification` is the blessed path, not a hard boundary** — anything holding a `SupabaseClient` can bypass it | An import-boundary lint is deferred "until there are callers to protect" (`lib/services/notifications.ts`). |
| 3.3 | **Health / books stay cut** (ADR-0011) | Never, per the plan's out-of-scope table. Do not reintroduce. |
| 3.4 | **System stewardship domain stays named "Inbox" in data** (ADR-0014) | Never. `/triage` is the UI, `/ingest` is the link list. |
| 3.5 | **`assembleDoingToday` survives alongside `buildDaySchedule`** | It feeds the widget payload and chat context; Today reads `daySchedule`. Retire it when those two callers migrate. |

## 4. Verification debt from the ops-shell plan

Acceptance criteria that were reasoned about and unit-tested but never
exercised end-to-end. Listed so nobody assumes they were seen working.

| # | Unverified | Why not | Coverage that exists |
|---|-----------|---------|----------------------|
| 4.1 | Timed event + timed task rendering on one timeline | No calendar events and no timed tasks existed on the day it shipped — only the Open band rendered | 11 unit tests over `buildDaySchedule` partition + sort |
| 4.2 | Changing the timezone moves `todayInTz` boundaries | Would have mutated `app_settings` | `isValidTimezone` unit tests; service rejects unknown zones |
| 4.3 | Setting N days puts a domain into "In brief" past 75% | Would have mutated a real domain | `withCadenceThresholdDays` round-trips through `cadenceThresholdDays` in tests |
| 4.4 | `POST /api/ingest` end-to-end after the ops-shell changes | A real capture writes `captured_data` and spends an LLM call | Guards re-checked live: 401 without auth, 400 on empty body; route present in the build |

## 5. Housekeeping

| # | Item | Notes |
|---|------|-------|
| 5.1 | **Seeded "Link Inbox" note is vestigial** | Row `7d1f6a2e-…` from migration `0001`, a markdown note shared links were once meant to append to. ADR-0014 replaced the design with `ingest_links`. Left in place — it is the owner's data, not the system's. |
| 5.2 | **Two test links sit in the reading pile** | `nextjs.org/docs` and `example.com/hello`, created while verifying `POST /api/links`, with their two `ingest.link` ledger rows. Dismissing them at `/ingest` is the intended cleanup. |
| 5.3 | **The 2026-07-19 review doc is point-in-time** | [`review-ui-architecture-2026-07-19.md`](./review-ui-architecture-2026-07-19.md) still says triage is "today still `/inbox`". Kept as a dated record of the argument, not corrected. |

---

## What is genuinely finished

So the next reader does not go looking: both execution plans are fully
executed, all ten ops-shell items shipped one commit each, the reconciliation
sweep cron exists, external ingest exists, web push is delivered inside
`recordNotification`, and migration `0006` is applied to the project. ADR-0008's
Deferred list and `lib/services/notifications.ts` both carried stale claims to
the contrary until 2026-07-19; both now say what is true.
