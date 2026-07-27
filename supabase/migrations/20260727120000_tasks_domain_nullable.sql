-- docs/adr/0025: "unfiled" is domain_id IS NULL.
--
-- The Inbox was a seeded stewardship_domains row that carried none of a
-- domain's semantics (no fruit_definition, no expected_cadence, no
-- failure_patterns), so every consumer filtered it back out via is_system.
-- NULL says the same thing without the row, so the row and the flag both go.
--
-- The base schema (20260714194155_schema.sql:935) still seeds the Inbox row;
-- on a fresh rebuild this migration removes it again, in order.
--
-- Deliberately unchanged: tasks_domain_id_fkey stays a bare `references`
-- (NO ACTION). `on delete set null` would silently un-file a domain's tasks,
-- and filing is one-way (ADR-0024 §3, carried forward). idx_tasks_domain also
-- stays — btree indexes store NULLs, so the inbox query still uses it.

alter table tasks alter column domain_id drop not null;

update tasks
  set domain_id = null
  where domain_id = 'acf035ee-b247-4c96-a07e-5946bc2b2e91';

delete from stewardship_domains
  where id = 'acf035ee-b247-4c96-a07e-5946bc2b2e91';

alter table stewardship_domains drop column is_system;
