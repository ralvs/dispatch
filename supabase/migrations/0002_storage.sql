-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — storage bucket + policies
-- ─────────────────────────────────────────────────────────────────────────
--
-- Private "media" bucket for uploads (health documents, attachments, etc).
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists media_authenticated_select on storage.objects;
create policy media_authenticated_select on storage.objects
  for select to authenticated
  using (bucket_id = 'media');

drop policy if exists media_authenticated_insert on storage.objects;
create policy media_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media');

drop policy if exists media_authenticated_update on storage.objects;
create policy media_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media')
  with check (bucket_id = 'media');

drop policy if exists media_authenticated_delete on storage.objects;
create policy media_authenticated_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media');


-- ─────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────
