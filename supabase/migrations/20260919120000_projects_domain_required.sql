-- A project always has a domain. The task form and resolveTaskRouting already
-- treat the project's domain as the one that wins (docs/adr/0019, amended
-- 2026-09-17), so an "Unassigned" project was a hole in that rule: its tasks
-- had nothing to inherit.
--
-- `on delete set null` goes with it, since it would now fail the NOT NULL.
-- NO ACTION makes the refusal explicit instead. Domains are never hard-deleted
-- by the app anyway — they are archived (active = false).

alter table projects alter column domain_id set not null;

alter table projects drop constraint projects_domain_id_fkey;
alter table projects
  add constraint projects_domain_id_fkey
  foreign key (domain_id) references stewardship_domains(id);
