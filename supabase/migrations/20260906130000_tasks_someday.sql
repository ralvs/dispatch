-- docs/plan-dispatch-shape-2026-08-21.html §03, P4: a want is a task with the
-- clock switched off.
--
-- "Buy milk tomorrow" is an action with a time. "Buy a new wardrobe" is an
-- intent with no time. Sharing one list made the second look overdue-ish
-- forever and made the list feel dishonest.
--
-- One boolean column, not a second table (decision D4). Promotion is clearing
-- the flag — never a copy from one table to another — so a want keeps its id,
-- its domain, its project tag, its notes and its whole history.
--
-- A want carries no due date by definition. Enforced here rather than only in
-- the form, so the capture path and any future writer cannot produce a want
-- that is also scheduled.

alter table tasks
  add column if not exists someday boolean not null default false;

alter table tasks
  drop constraint if exists tasks_someday_has_no_due_date;
alter table tasks
  add constraint tasks_someday_has_no_due_date
    check (not someday or due_date is null);

create index if not exists idx_tasks_someday on tasks(someday)
  where someday = true;
