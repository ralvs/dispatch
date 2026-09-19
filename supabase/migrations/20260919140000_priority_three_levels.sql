-- Priority is three levels: 1 high, 2 medium, 3 low. The column allowed 1–4
-- while the UI offered three, so 3 and 4 both meant "low" and every writer had
-- to know that. One stored value per level removes the mapping.

update tasks set priority = 3 where priority = 4;

alter table tasks drop constraint tasks_priority_check;
alter table tasks
  add constraint tasks_priority_check check (priority between 1 and 3);

alter table tasks alter column priority set default 3;
