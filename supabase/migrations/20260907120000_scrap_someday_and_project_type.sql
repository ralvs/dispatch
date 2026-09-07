-- Scrap `tasks.someday`, `projects.type` and `projects.kind`.
--
-- someday shipped one day ago and was never used — zero rows carry it. It said
-- "this task has the clock switched off", and it said it by forbidding a due
-- date outright, which is a worse instrument than the one that replaces it.
--
-- The replacement is quiet, and it needs no column: only an *active* project's
-- tasks reach Today and the default /tasks views. A task in a project whose
-- status is paused, done or archived is quiet. projects.status already exists
-- with exactly those four values.
--
-- Quiet is strictly more capable than someday. A due date always wins — a
-- dated task surfaces normally however quiet its project — so parking work no
-- longer means giving up the ability to schedule it. A task with no project is
-- never quiet. And parking is now one gesture on the project instead of a
-- per-task flag nobody remembered to set.
--
-- type (client/internal/content) and kind (project/area) go for a different
-- reason: neither was ever read for behaviour. Both were display-only badges,
-- and the project's domain already carries what they tried to say. There is no
-- replacement vocabulary.

-- The inline CHECK constraints on all three columns are anonymous, and Postgres
-- drops a column's own constraints and indexes with it. Only the named ones
-- need saying out loud.

alter table tasks
  drop constraint if exists tasks_someday_has_no_due_date;

drop index if exists idx_tasks_someday;

alter table tasks
  drop column if exists someday;

drop index if exists idx_projects_kind_status;

alter table projects
  drop column if exists type;

alter table projects
  drop column if exists kind;
