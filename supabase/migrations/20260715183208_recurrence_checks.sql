-- Align recurrence_rule CHECK constraints with lib/recurrence.ts's
-- RECURRENCE_PATTERNS (7 values, incl. semiannually). The original
-- project_checklist_items constraint only allowed 6 values and silently
-- rejected 'semiannually'; tasks.recurrence_rule had no constraint at all.

alter table project_checklist_items
  drop constraint if exists project_checklist_items_recurrence_rule_check;

alter table project_checklist_items
  add constraint project_checklist_items_recurrence_rule_check
  check (recurrence_rule is null or recurrence_rule in
    ('daily','weekdays','weekly','biweekly','monthly','semiannually','yearly'));

alter table tasks
  add constraint tasks_recurrence_rule_check
  check (recurrence_rule is null or recurrence_rule in
    ('daily','weekdays','weekly','biweekly','monthly','semiannually','yearly'));
