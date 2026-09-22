-- State the public schema's grants instead of inheriting them (docs/adr/0063).
--
-- The hosted project was created while Supabase still granted every Data API
-- role full access to new public tables by default, so no migration here ever
-- said so. Newer Postgres images no longer do: on a fresh `supabase start`,
-- anon/authenticated/service_role could touch no table, and every query from
-- the app failed with "permission denied". RLS was always the real door
-- (20260714194155_schema.sql, "authenticated users can do everything"); these
-- grants only let the roles reach it.
--
-- On the hosted project this is a no-op: it mirrors, privilege for privilege,
-- the grants and default privileges already in place there (checked 2026-09-22).

-- Tables list their privileges rather than `all`: on Postgres 17 `all` also
-- carries MAINTAIN, which the hosted tables do not have, so `all` would not be
-- a no-op there. The default privileges below do include it, as they do there.
grant select, insert, update, delete, truncate, references, trigger
  on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
