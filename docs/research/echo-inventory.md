# Echo inventory: what Memex must keep

Research for ralvs/dispatch#118 (map: #117). Snapshot 2026-10-08. Echo repo:
`ralvs/echo` at `/Volumes/stuff/renan/echo` (paths below are relative to it).
Live data: Supabase project `pszqamrywfiyldjsfwph`, SELECT only. No design here.

## SQL used

- **Q1** (counts, last write):
  `select 'thoughts', count(*), max(updated_at) from thoughts union all … thought_versions (max archived_at), thought_relations (max created_at), entities (max updated_at), thought_entities, entity_edges, entity_pages (max updated_at), topic_pages (max updated_at)`
- **Q2** (thought mix): `select metadata->>'type', source, count(*), max(created_at), count(*) filter (where metadata ? 'due_date') from thoughts group by 1,2`
- **Q3** (relations, dream bundles): `select relation_type, count(*) from thought_relations group by 1` plus `count(*) from thoughts where metadata->>'source_id' like 'dream:%' or metadata ? 'bundle'`
- **Q4**: `select table_name from information_schema.tables where table_schema='public'` → 8 tables, no `people` (dropped at `supabase/migrations/00023_merge_people_into_entities.sql:114`).

Results: thoughts 37 (last write 2026-10-07); thought_versions 18 (last 2026-05-03);
thought_relations 78 (last 2026-05-26; extends 29, related 42, updates 7);
entities 108 (last 2026-10-07); thought_entities 37; entity_edges 153;
entity_pages 5 (last 2026-09-06); topic_pages 6 (last 2026-09-08); dream bundle rows 0.
Thought mix (Q2): 18 observation, 7 task, 4 reference, 4 person_note, 3 log, 1 idea;
**none carries a due date**; the newest thought was created 2026-05-26.
Orphan/stale entity figures (94 orphaned, 147 stale edges) are from #117, not re-run.

Nightly log `~/Library/Logs/echo/dream.jsonl` (127 lines): last run
2026-10-07T06:04Z, catch-up `scanned 0 captured 0`, dream `proposals 0`.

## 1. Parity table

Verdicts: **keep** = Memex must have it at v1; **later** = after v1;
**drop** = do not rebuild.

### Tables

| Capability | What it does | In use? | Verdict |
|---|---|---|---|
| `thoughts` (`00001_baseline_thoughts.sql:12`) | The single write model: content + JSONB metadata + `vector(1536)` embedding (`:15`) | 37 rows, last write 2026-10-07 (Q1) | **keep** — the unit of knowledge per #117 ("Thought stays") |
| `thought_versions` (`00002_add_versioning.sql:17`) | Archive of prior content on update/resolve | 18 rows, last 2026-05-03 | **keep** — cheap audit trail of engine edits; matters once Memex rewrites thoughts |
| `thought_relations` (`00011_knowledge_graph.sql:7`) | Typed thought→thought edges (updates / extends / related) | 78 rows, all valid per #117, last 2026-05-26 | **keep** — `updates` is how staleness and contradictions are found |
| hybrid search (`00008_add_hybrid_search.sql:80`, `00009_memory_classification.sql:22`), `match_thoughts` (`00006…:5`) | Vector + English FTS ranked search | Read path of `search_thoughts` | **keep** — query is a core operation; FTS config must change (rule 5) |
| `entities` / `thought_entities` / `entity_edges` (`00021_entities.sql:18,44,58`) | Extracted people/projects/orgs/tools/places and a co-occurrence graph | 108 / 37 / 153 rows; 94 orphaned, 147 stale (#117) | **later** — data is rotten; #117 says re-extract, not copy; graph analytics need no UI at v1 |
| `entity_pages` (`00022_entity_pages.sql:11`) | LLM-compiled wiki page per entity | 5 rows, last 2026-09-06 | **later** — form is an open question in #117 ("Compiled pages") |
| `topic_pages` (`00012_topic_pages.sql:8`) | LLM-compiled page per topic with ≥3 thoughts | 6 rows, last 2026-09-08 | **keep** (as a concept) — this is the "wiki" in the LLM Wiki pattern; storage shape is open |
| `people` (`00017_people_table.sql:1`) | Former person registry | Dropped (`00023…:114`) | **drop** — already gone; people are a later source in #117 |
| Scheduling metadata (`00003_add_scheduling.sql`) | due dates / recurrence on thoughts | 0 thoughts have a due date (Q2) | **drop** — Dispatch tasks own scheduling |
| Decomposition / bundles (`00004_add_decomposition.sql`; ADR `docs/adr/0022-…md:3`) | Parent/child thoughts; dream report stored as one `is_bundle` thought | 0 bundle rows (Q3) | **drop** the bundle trick — proposals need a proper home in Memex |

### MCP tools (`supabase/functions/echo-mcp/tools/`, 21 registered via `tools/contract.ts:39`)

| Tool | What it does | Verdict |
|---|---|---|
| `capture_thought` (`capture-thought.ts:20`) | Save a thought; embeds and extracts metadata | **keep** — ingest; Claude sessions still need a write door |
| `update_thought` (`update-thought.ts:14`) | Revise content, archive version, re-run relations | **keep** |
| `delete_thought` (`delete-thought.ts:12`) | Hard delete thought + versions | **later** — keep only with a notification and soft delete (rules 6, 4) |
| `resolve_thought` (`resolve-thought.ts:17`) | Toggle done; advance recurrence | **drop** — task semantics belong to Dispatch tasks |
| `list_due` (`list-due.ts:32`) | Overdue/upcoming thoughts | **drop** — no thought has a due date (Q2); Dispatch Today covers it |
| `search_thoughts` (`search-thoughts.ts:50`) | Semantic + keyword search | **keep** — query |
| `list_thoughts` (`list-thoughts.ts:41`) | Filtered recent list | **keep** |
| `get_thought_context` (`get-thought-context.ts:13`) | Thought + relation neighbours | **keep** |
| `thought_stats` (`thought-stats.ts:12`) | Totals by type/topic/person | **later** — diagnostic only |
| `get_profile` (`get-profile.ts:14`) | LLM-synthesised user profile | **later** — paid call, overlaps topic pages |
| `list_topic_pages` / `get_topic_page` / `refresh_topic_page` (`list-topic-pages.ts:12`, `get-topic-page.ts:12`, `refresh-topic-page.ts:12`) | Read and recompile topic pages | **keep** — the wiki read/compile surface |
| `list_entities` / `get_entity` / `refresh_entity_page` (`list-entities.ts:12`, `get-entity.ts:13`, `refresh-entity-page.ts:12`) | Entity listing, brief, page compile | **later** — follows the entity verdict |
| `find_path` / `graph_overview` (`find-path.ts:46`, `graph-overview.ts:25`) | Graph path and centrality/cluster analysis | **drop** — graph exploration; no graph UI and stale edges |
| `lint_thoughts` (`lint-thoughts.ts:56`) | Contradictions, orphans, stale, duplicates | **keep** — this is the lint operation (Dream as a job) |
| `dream_review` / `dream_apply` (`dream.ts:81`) | Show and apply numbered dream proposals | **keep** (the review/apply idea) — surface TBD by the questions ticket |

### Scripts / jobs

| Script | What it does | In use? | Verdict |
|---|---|---|---|
| `scripts/nightly.ts:3-13` | launchd job: catch-up then dream | Runs nightly; last 2026-10-07 found 0 turns, 0 proposals (dream.jsonl) | **keep** the job, **drop** the laptop host — runs on Vercel cron in Dispatch |
| `scripts/dream.ts:3-11` (+ `supabase/functions/_shared/dream.ts:570`) | Manual dream: transcript diff + health checks, USD cap | Same pipeline; 0 proposals lately | **keep** the health-check leg, **later** the transcript leg |
| `scripts/mine-claude-transcripts.ts:3-10`, `scripts/claude-hooks/*` | Mine Claude Code/Grok transcripts through a Haiku relevance gate | Source of most thoughts (Q2 `mcp`); last new thought 2026-05-26; recent failures in `~/Library/Logs/echo/ingest.err.log` | **later** — v1 sources are notes + task completions only (#117) |
| `scripts/backfill-entities.ts:3-13`, `backfill-relations.ts:3-8` | One-shot backfills | Migration-era tools | **drop** — Memex re-extracts at migration |
| `scripts/reembed-thoughts.ts:3-14` | Recompute embeddings after a text change | Ad hoc | **keep** (as a migration/backfill step) — needed whenever embedding text changes |
| `scripts/review-eval-queries.ts:3-11` | Render golden queries for review | Ad hoc | **later** — with the eval |
| `scripts/install-skills.sh` | Symlink skills into `~/.claude` and `~/.grok` | Installed | **drop** — repoint, not reinstall |

### Skills (`skills/README.md` table)

| Skill | Verdict |
|---|---|
| `dream` | **keep** — repoint to Memex's review surface |
| `echo-capture` | **keep** — repoint to Memex capture |
| `research-synthesis` | **keep** — pure query over search; cheap to repoint |
| `entity-brief` | **later** — depends on entities |
| `graph-tour` | **drop** — graph exploration, out of scope |
| `meeting-synthesis`, `panning-for-gold` | **later** — they capture into the wiki; Memex proposes notes instead (#117 ownership) |

### Evals

| Capability | Verdict |
|---|---|
| `evals/eval.ts:1-14` retrieval harness (nDCG@10, hit@3 over live corpus); `eval-queries.sample.json` | **keep** — measures query quality before tuning, like Dispatch's `eval:parser`; golden file must be rebuilt (corpus changes) |

## 2. Where Echo breaks a Dispatch iron rule

- **Rule 5 (stored verbatim, never translated).** Echo translates everything to English before storing: `docs/adr/0013-single-language-english-storage.md:1-3`; gate prompt `supabase/functions/_shared/relevance-gate.ts:50`. FTS is `to_tsvector('english', …)` (`00008_add_hybrid_search.sql:28`), so PT-BR text ranks badly.
- **Rule 2 (`requireOwner()` / no unauthenticated surface).** The MCP endpoint checks the owner (`supabase/functions/echo-mcp/index.ts:140-143`), but scripts and hooks "talk to the DB directly with the service-role key and never hit this endpoint" (`index.ts:66-67`; `scripts/lib/ingest.ts:50`). Any machine with the key is the owner.
- **Rule 3 (`sb` first, RLS-scoped when possible).** Tools run on a service-role client (`index.ts:72`), so RLS never scopes a read; tables have RLS enabled but no owner policies (Q: `grep "create policy" supabase/migrations` returns nothing).
- **Rule 6 (every autonomous action writes a notification).** Nightly auto-applies "safe maintenance fixes" (`scripts/nightly.ts:6`) and compiles pages without any notification; there is no notifications concept (`grep -ri notification supabase/functions/_shared lib` returns nothing).
- **Rule 4 (never lose a capture).** Failed ingests are logged to `~/Library/Logs/echo/ingest.err.log` and skipped (e.g. 2026-09-07 "socket connection was closed"), not kept as a `needs_review` row. `delete_thought` hard-deletes with history (`delete-thought.ts:12`).
- **Rule 1 (app timezone at the boundary).** The nightly window starts from raw `new Date()` (`scripts/nightly.ts:175`) on a launchd clock, not `lib/dates.ts` with `America/Sao_Paulo`.
