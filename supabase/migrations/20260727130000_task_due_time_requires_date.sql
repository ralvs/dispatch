-- A task can currently carry a due_time with no due_date: the two columns
-- have never been coupled. That state is meaningless (there is nothing to
-- put the time "on") and every consumer already treats it as such —
-- lib/reminders.ts keys reminders off due_date and silently drops the time
-- when due_date is null. Make the invariant structural rather than
-- convention: due_time may only be set alongside a due_date.
--
-- Cleanup runs first so the constraint below doesn't fail against any
-- existing violating rows (there are none in production today, but the
-- guard has to hold regardless).
update tasks set due_time = null where due_date is null;

alter table tasks
  drop constraint if exists tasks_due_time_requires_due_date_check;

alter table tasks
  add constraint tasks_due_time_requires_due_date_check
  check (due_time is null or due_date is not null);
