-- docs/plan-dispatch-shape-2026-08-21.html §08, Phase B. See docs/adr/0056.
--
-- Phase A took these out of the code and left the rows in Postgres. This drops
-- them. It is not reversible: there is no down script, and recovery means a
-- point-in-time restore.
--
-- Row counts at drop time, checked against the live database first:
--   milestones                2 (one done, one open — dropped on the owner's
--                                explicit instruction, not silently)
--   project_checklist_items   0
--   activity_log              0
--   action_log                0
--   inventory_items           0
--   inventory_categories      0
--   projects.client_id        0 set
--   projects.quoted_hours     0 set
--   projects.hours_logged     0 non-zero
--   projects.engagement_type  9 rows, every one holding the column default
--   tasks.parent_task_id      0 set
--
-- Nothing outside these objects referenced them, so no cascade is needed
-- beyond the constraints Postgres drops with each table. `observations` is
-- deliberately NOT here — it was equally dead when §08 was written, and §04
-- wired it.

-- The agency half: billing, delivery record, asset register (ADR-0055).
drop table if exists activity_log;
drop table if exists action_log;
drop table if exists inventory_items;
drop table if exists inventory_categories;

-- Milestones: a weighted checklist a project could claim progress from
-- without any task moving. Replaced by tasks done / open (plan D2).
drop table if exists milestones;

-- Never built, generated types only.
drop table if exists project_checklist_items;

alter table projects
  drop column if exists client_id,
  drop column if exists quoted_hours,
  drop column if exists hours_logged,
  drop column if exists engagement_type;

alter table tasks
  drop column if exists parent_task_id;
