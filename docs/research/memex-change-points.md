# Memex change points and vector search cost (#119)

Research for ralvs/dispatch#119, under the map in ralvs/dispatch#117. Facts only; no design is chosen.
Code refs are against `origin/main` at `6e39c48`. DB facts come from read-only queries on
`woiiepnagkzxinmkmbcx` run on 2026-10-08.

## Q1. Where notes and tasks change

### Raw table writes (non-test code)

| Table write | Location |
|---|---|
| `notes` insert | `lib/services/notes.ts:85` (`createNote`; `createNeedsReviewNote` at :117 builds on it) |
| `notes` update | `lib/services/notes.ts:189` (`updateNote`), `:225` (`resolveNeedsReview`), `setPin` at :208 |
| `notes` delete | `lib/services/notes.ts:229` (`deleteNote`) |
| `notes` update via SQL RPC | `note_body_append` (`supabase/migrations/20261005211643_note_body_append.sql:31`), `note_attachment_add` / `_remove` (`supabase/migrations/20260818184218_note_attachments.sql:29,42`) |
| `tasks` insert | `lib/services/tasks.ts:236` (`createTask`; recurring successor via `spawnNextOccurrence` :406 → :412) |
| `tasks` update | `lib/services/tasks.ts:280` (`updateTask`), `:363` (`completeTask` → `status: "done"`), `:436` (`reopenTask`), `:458-461` (`setTop3`), `:482` (`assignDomain`), `lib/services/reminders.ts:46` (`reminders_sent`) |
| `tasks` delete | `lib/services/tasks.ts:440` (`deleteTask`) |
| `tasks` update via SQL | RPC `task_notes_append` (`supabase/migrations/20261005205836_task_notes_append.sql:34`); trigger `trg_projects_domain_moves_tasks` (`supabase/migrations/20261002120000_task_domain_follows_project.sql:52,60`) |
| Cascade deletes | `tasks.parent_task_id` (`supabase/migrations/20260714194155_schema.sql:212`); `person_mentions`, `note_links` cascade from notes/tasks (`20260728100200_person_mentions.sql:9-10`, `20260723211225_note_links.sql:7-10`) |

### Callers by surface

| Surface | Path:line | Funnels through |
|---|---|---|
| Notes UI: new note | `app/(authed)/notes/actions.ts:46` | `createNote` |
| Notes UI: edit body/title | `app/(authed)/notes/actions.ts:64` | `updateNote` |
| Notes UI: move domain | `app/(authed)/notes/actions.ts:84` | `updateNote` |
| Notes UI: resolve review | `app/(authed)/notes/actions.ts:92` | `resolveNeedsReview` |
| Notes UI: pin | `app/(authed)/notes/actions.ts:104` | `setPin` |
| Notes UI: delete | `app/(authed)/notes/actions.ts:117` | `deleteNote` |
| Notes UI: remove attachment | `app/(authed)/notes/actions.ts:153` | `removeAttachment` → RPC `note_attachment_remove` (`lib/services/note-attachments.ts:87`) |
| Attachment upload (HTTP) | `app/api/notes/[id]/attachments/route.ts:125` | `uploadAttachment` → RPC `note_attachment_add` (`lib/services/note-attachments.ts:55`) |
| Today: meeting note | `app/(authed)/today/actions.ts:101` | `createNote` |
| Capture executor: note | `lib/services/capture/executor.ts:133` | `createNote` |
| Capture executor: task | `lib/services/capture/executor.ts:119` | `createTask` |
| Capture degrade (needs_review) | `lib/services/capture/degrade.ts:21`, called from `capture/index.ts:117,169`, `executor.ts:46`, `sweep.ts:72` | `createNeedsReviewNote` |
| Quick-add task | `lib/services/capture/quick-add.ts:41,52` | `createTask` |
| Capture entry points | `app/api/capture/route.ts:119`, `lib/actions/capture.ts:33` | `capture()` (`lib/services/capture/index.ts:76`) → above |
| Sweep cron | `app/api/cron/sweep/route.ts` → `sweepRawCaptures` | `createNeedsReviewNote` |
| Reminders cron | `app/api/cron/reminders/route.ts` → `lib/services/reminders.ts:46` | raw `tasks` update (`reminders_sent` only) |
| Tasks UI: create | `lib/actions/tasks.ts:36` | `createTask` |
| Tasks UI: edit | `lib/actions/tasks.ts:83` | `updateTask` |
| Tasks UI: complete | `lib/actions/tasks.ts:123` | `completeTask` (may insert successor) |
| Tasks UI: uncomplete | `lib/actions/tasks.ts:136` | `reopenTask` |
| Tasks UI: delete | `lib/actions/tasks.ts:144` | `deleteTask` |
| MCP `create_note` | `app/api/mcp/tools/notes.ts:124` | `createNote` |
| MCP `update_note` | `app/api/mcp/tools/notes.ts:205` | `updateNote` |
| MCP append to note | `app/api/mcp/tools/notes.ts:189` | RPC `note_body_append` (bypasses `updateNote`) |
| MCP `create_task` | `app/api/mcp/tools/tasks.ts:144` | `createTask` |
| MCP `update_task` | `app/api/mcp/tools/tasks.ts:231` | `updateTask` |
| MCP append to task notes | `app/api/mcp/tools/tasks.ts:211` | RPC `task_notes_append` (bypasses `updateTask`) |

MCP has no complete or delete tool for tasks or notes (`rg omplete app/api/mcp/tools/tasks.ts` finds none).
Task completion goes only through `completeTask`, from one caller (`lib/actions/tasks.ts:123`).

**Is there one choke point?** No, not in TypeScript. Notes are written by four `notes.ts` functions plus
three SQL RPCs. Tasks are written by seven `tasks.ts` functions, `reminders.ts:46`, one RPC and one
trigger, and cascades delete rows without any app call. The only place that sees every change is the
table itself (`public.notes`, `public.tasks`). Task *completion* alone does have one choke point:
`completeTask` (`lib/services/tasks.ts:338`).

## Q2. Change-feed options on Supabase

Installed state: none of `pg_net`, `pgmq`, `pg_cron` is installed; all are available
(`pg_available_extensions`: pg_net 0.20.3, pgmq 1.5.1, pg_cron 1.6.4).

| Option | Latency | Failure mode | Lives only in `memex`? |
|---|---|---|---|
| **Trigger → outbox table** (`after insert/update/delete on public.notes for each row` inserts into `memex.outbox`) | Sync, in the writer's transaction; consumer latency = poll interval (cron) | Trigger error aborts the write, so it can fail capture (iron rule 4) unless it swallows exceptions. Durable: outbox commits with the row | **No.** Function and table can live in `memex`, but the trigger object belongs to `public.notes`/`public.tasks`. Revert needs `drop trigger ... on public.notes` before or with `drop schema memex cascade` (cascade drops triggers whose function is in `memex`, per Postgres dependency rules) |
| **pg_net from a trigger** | Async; request starts after commit (https://supabase.com/docs/guides/database/extensions/pg_net) | Fire-and-forget. Requests/responses in unlogged tables, lost on crash; responses kept 6 h; ~200 req/s ceiling; default 2 s timeout (same page, "Limitations"). No retry | No: still a trigger on `public.*`; extension lives in schema `net` |
| **Database Webhooks** | Same as pg_net (it is a wrapper over triggers + pg_net, https://supabase.com/docs/guides/database/webhooks) | Same as pg_net; log in `net` schema | No: trigger on `public.*` calling `supabase_functions.http_request` |
| **Realtime (Postgres Changes)** | Push over websocket, near-instant | Needs a long-lived subscriber; Vercel functions are not long-lived. Missed events are not replayed (https://supabase.com/docs/guides/realtime/postgres-changes) | No: tables must be added to the `supabase_realtime` publication (a change outside `memex`) |
| **pgmq (Supabase Queues)** | Enqueue in trigger, consumer reads on poll; visibility timeout gives retries (https://supabase.com/docs/guides/queues) | Durable, transactional with the write; same abort risk as outbox if enqueue throws | No: needs a trigger on `public.*`; queues live in schema `pgmq` |
| **Polling `updated_at`** (no trigger) | = poll interval | Misses hard deletes; both tables have `updated_at` triggers (`20260906150000_notes_updated_at.sql:30`, `20260714194155_schema.sql:233`), but `note_body_append` etc. rely on those triggers to bump it | **Yes**: only reads `public.*`; state lives in `memex`. Deletes need a diff of ids |
| **App-level hook in services** | Sync or `after()` | Bypassed by the 3 RPCs, the trigger and cascades (Q1) | No: Dispatch would import Memex, against #117 |

Every DB-side push option needs an object attached to `public.notes`/`public.tasks`, so the
"delete folder + drop schema memex" revert gains a step unless the trigger function lives in `memex`
and is dropped by `cascade`.

## Q3. pgvector and embedding cost

- `vector` 0.8.2 is available on the project, not installed (query above). Supabase guide:
  https://supabase.com/docs/guides/database/extensions/pgvector. HNSW index supports up to 2,000
  dims for `vector` (https://github.com/pgvector/pgvector#hnsw).
- Current corpus: 128 notes, average 144 words in `body` (read-only `count`/`avg` query).
- Embedding models on AI Gateway (https://vercel.com/ai-gateway/models?type=embedding, read 2026-10-08),
  input price per 1M tokens; dimensions from provider docs where the Gateway page omits them:

| Model | Dims | $/1M tokens |
|---|---|---|
| openai/text-embedding-3-small | 1536 (shortenable) — https://platform.openai.com/docs/guides/embeddings | 0.02 |
| openai/text-embedding-3-large | 3072 (shortenable) — same | 0.13 |
| amazon/titan-embed-text-v2 | 1024/512/256 (Gateway page) | 0.02 |
| cohere/embed-v5.0-fast | 256–2048 (Gateway page) | 0.08 |
| google/gemini-embedding-001 | 3072 (shortenable) — https://ai.google.dev/gemini-api/docs/embeddings | 0.15 |
| google/text-multilingual-embedding-002 | 768 — https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings | 0.03 |
| voyage/voyage-4-lite | per Voyage docs (https://docs.voyageai.com/docs/embeddings) | 0.02 |
| alibaba/qwen3-embedding-8b | per model card | 0.01 |

Others listed: qwen3 0.6b/4b, cohere v4/v5-pro, gemini-embedding-2, text-embedding-005, mistral-embed,
codestral-embed, ada-002, pplx-embed, voyage 3.5/4/4-large/code/finance/law. Bilingual PT-BR/EN
(iron rule 5) narrows this to multilingual models; that check is not done here.

**Cost for 1k notes × 300 words.** Assumption: ~1.33 tokens/word (English; Portuguese tokenizes
somewhat higher) → ~400k tokens per full embed.

| Price tier | Full corpus embed |
|---|---|
| $0.01–0.02 /1M | $0.004–0.008 |
| $0.13 /1M | $0.05 |
| $0.20 /1M (top listed) | $0.08 |

Storage: 1k × 1536 float4 ≈ 6 MB plus index. Re-embedding on every edit is the only recurring cost.

## Q4. Crons today

- `vercel.json` has no `crons` key, only `"regions": ["gru1"]` (`vercel.json:1-4`).
- Four routes, all invoked externally by **cron-job.org** with `Authorization: Bearer CRON_SECRET`:
  `app/api/cron/sweep/route.ts:10-11,18`, `app/api/cron/reminders/route.ts:10` (every 5 min),
  `app/api/cron/caldav/route.ts:11`, `app/api/cron/observations/route.ts:10`. Each accepts GET (the
  cron-job.org default) and POST (e.g. `sweep/route.ts:50`).
- Auth: `isAuthorized` (`lib/secret-auth.ts:34-38`) — SHA-256 both sides then `timingSafeEqual`
  (`:24-28`); unset secret always fails.
- Cron routes use the service-role client (`sweep/route.ts:25`) and write a `notifications` row only
  when they acted (`sweep/route.ts:28-41`, iron rule 6).
- Vercel Cron limits (https://vercel.com/docs/cron-jobs/usage-and-pricing): 100 jobs per project on
  every plan; Hobby = once per day, ±59 min precision; Pro = once per minute, per-minute precision.
  Each run is a normal function invocation with function limits. Schedules on cron-job.org are
  outside the repo and were not inspected.
- In-DB alternative: `pg_cron` 1.6.4 is available, not installed; pairs with pg_net for minute
  schedules (https://supabase.com/docs/guides/database/extensions/pg_net, "Call an endpoint every minute").
