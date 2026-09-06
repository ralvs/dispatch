# Phase B: the agency schema is dropped, not just retired

The shape plan (`docs/plan-dispatch-shape-2026-08-21.html` §08) split every
removal in two. Phase A stopped the code reading a column or table; the rows
stayed in Postgres, reachable, and the whole thing was reversible in an
afternoon. Phase B drops them in SQL. This ADR records Phase B, following the
ADR-0007 precedent for dropping tables the app does not use.

`supabase/migrations/20260906160000_phase_b_drops.sql` drops six tables and
five columns:

| Dropped | Rows at drop time |
| --- | --- |
| `milestones` | 2 |
| `project_checklist_items` | 0 |
| `activity_log` | 0 |
| `action_log` | 0 |
| `inventory_items` | 0 |
| `inventory_categories` | 0 |
| `projects.client_id` | 0 set |
| `projects.quoted_hours` | 0 set |
| `projects.hours_logged` | 0 non-zero |
| `projects.engagement_type` | 9 rows, all `'project'` — the default |
| `tasks.parent_task_id` | 0 set |

## Why now, and not after longer

§08 said Phase B comes "only after living without it long enough to be sure",
and it has not been long. The counts are the argument: everything except
`milestones` was already empty, and `engagement_type` held its own default on
every row, so there was nothing to be sure about. Phase A had nothing to prove
for a column no row ever used.

`milestones` is the one real loss. It held two rows on the Dispatch project —
one done, one open — and the owner chose to drop both rather than rescue the
open one as a task. Recorded here because a drop that loses live content should
be written down, not inferred later from a row count of zero.

## Why the whole agency half goes together

ADR-0055 states the rule these all follow from: Linear owns delivery history,
Dispatch owns attention. `client_id`, `quoted_hours`, `hours_logged` and
`engagement_type` exist to bill a client. `activity_log` and `action_log` are a
per-project update record kept for someone else's benefit. `inventory_items`
and `inventory_categories` are an insurance and resale register. `milestones`
is a weighted checklist that let a project claim progress no task had made —
plan D2 replaced it with tasks done over open, which is the same number read
from work that actually exists.

`project_checklist_items` and `tasks.parent_task_id` are different: never used,
never built, generated types only. They go because a schema that describes
features the app does not have is a map of a place that is not there.

## What this costs

The migration is not reversible. There is no down script, and restoring means a
point-in-time restore of the database — which is the honest position for a drop,
not a shortcoming of this one. Nothing else in the schema referenced the dropped
tables except their own foreign keys, so `drop table` needs no cascade beyond
the constraints Postgres removes with them.

`observations` stays. It was equally dead at the time §08 was written, and §04
wired it — the neglect sweep writes to it now.
