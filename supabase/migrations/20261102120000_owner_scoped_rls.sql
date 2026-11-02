-- Scope every RLS policy to the owner (docs/adr/0095).
--
-- Until now each public table had one policy, `for all to authenticated using
-- (true) with check (true)`, and the media bucket the same. Any signed-in
-- account could read and write everything through PostgREST and Storage; the
-- only thing between a stranger and the data was the hosted "sign-ups off"
-- switch. This puts the owner check in the database, so a second account
-- reads nothing and writes nothing even if that switch flips.

-- ─────────────────────────────────────────────────────────────────────────
-- The owner, in one place
-- ─────────────────────────────────────────────────────────────────────────

-- `private` is not in the Data API's exposed schemas (supabase/config.toml),
-- and the default privileges of migration 20260922120000 cover `public`
-- only, so nothing here is reachable over PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- One row at most: the boolean primary key can only be `true`.
create table if not exists private.owner (
  id      boolean primary key default true check (id),
  user_id uuid not null
);
revoke all on private.owner from public, anon, authenticated;

-- Security definer, so policies can read private.owner while the calling
-- role cannot. An empty table means nobody is the owner: fail closed.
create or replace function private.is_owner()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from private.owner where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated, service_role;

-- The hosted project has exactly one account, the owner's (checked
-- 2026-11-02). Take it from there rather than writing its id into a public
-- repo. A fresh local stack has no accounts yet when migrations run;
-- supabase/seed.sql names the local owner. More than one account means
-- someone else got in: stop the deploy rather than guess.
do $$
declare
  account_count int;
begin
  select count(*) into account_count from auth.users where not is_anonymous;
  if account_count > 1 then
    raise exception
      'owner_scoped_rls: % accounts in auth.users, expected the owner alone. Remove the others, then re-run.',
      account_count;
  end if;
  insert into private.owner (user_id)
  select id from auth.users where not is_anonymous
  on conflict (id) do nothing;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Public tables
-- ─────────────────────────────────────────────────────────────────────────

-- Every `<table>_authenticated_all` policy (the schema migration's loop, plus
-- ingest_links, note_links and mentions, which copied it) becomes
-- `<table>_owner_all`. Tables with RLS on and no policy (caldav_sync_state,
-- google_sync_state, push_subscriptions) stay service-role only.
do $$
declare
  p record;
  t text;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and policyname like '%\_authenticated\_all'
  loop
    t := p.tablename;
    execute format('drop policy %I on public.%I', p.policyname, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((select private.is_owner())) with check ((select private.is_owner()))',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: the media bucket
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists media_authenticated_select on storage.objects;
drop policy if exists media_authenticated_insert on storage.objects;
drop policy if exists media_authenticated_update on storage.objects;
drop policy if exists media_authenticated_delete on storage.objects;

create policy media_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select private.is_owner()));

create policy media_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_owner()));

create policy media_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select private.is_owner()))
  with check (bucket_id = 'media' and (select private.is_owner()));

create policy media_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select private.is_owner()));
