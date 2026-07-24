-- Task reminders are configured once, globally, not per task (docs/adr/0020):
-- reminder_offset_minutes is how long before the due instant to fire (0 = at
-- the due time), and reminder_anchor_time is the wall-clock time a task that
-- has a due date but no due time anchors to. app_settings is a singleton row.
alter table app_settings
  add column if not exists reminder_offset_minutes integer not null default 0,
  add column if not exists reminder_anchor_time time not null default '09:00';
