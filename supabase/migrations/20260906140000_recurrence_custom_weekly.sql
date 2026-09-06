-- docs/plan-dispatch-shape-2026-08-21.html §06, P7: the custom weekly rule.
--
-- The plan calls this "the one feature on the whole plan that needs no SQL",
-- on the grounds that tasks.recurrence_rule is plain text. The column is text,
-- but it is not unconstrained: 20260715183208_recurrence_checks.sql added
-- tasks_recurrence_rule_check limiting it to the seven literals, so a
-- `weekly:tu,sa` insert would be rejected by Postgres. This widens it.
--
-- The pattern accepts `weekly:` followed by one to seven comma-separated
-- two-letter weekday codes. It deliberately does not enforce uniqueness or
-- ordering — lib/recurrence.ts's parser is strict about both and normalises on
-- write; the constraint's job is to keep the column readable, not to duplicate
-- the parser.
--
-- The seven literals stay valid exactly as they are. `weekdays` keeps its own
-- literal rather than becoming `weekly:mo,tu,we,th,fr` (plan O8): the stored
-- rows already say `weekdays`, and a rewrite buys nothing.

alter table tasks
  drop constraint if exists tasks_recurrence_rule_check;

alter table tasks
  add constraint tasks_recurrence_rule_check
  check (
    recurrence_rule is null
    or recurrence_rule in
      ('daily','weekdays','weekly','biweekly','monthly','semiannually','yearly')
    or recurrence_rule ~ '^weekly:(su|mo|tu|we|th|fr|sa)(,(su|mo|tu|we|th|fr|sa)){0,6}$'
  );
