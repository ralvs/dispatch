-- The day of the month a month-stepped recurring task is meant to fall on,
-- kept only while its due date is clamped to a shorter month's last day.
--
-- A monthly task on the 31st is due Apr 30 and Feb 28 because those months
-- end early. Each completion spawns the next occurrence from the one before
-- (docs/adr/0059), so without this the series would take the 30th, then the
-- 28th, as its day for good. lib/recurrence.ts (intendedMonthDay) reads it;
-- completeTask writes it on the spawned row. Null on every other row.
--
-- Only 29–31 can clamp: every month has a 28th.

alter table tasks
  add column recurrence_day smallint
  constraint tasks_recurrence_day_check check (recurrence_day between 29 and 31);
