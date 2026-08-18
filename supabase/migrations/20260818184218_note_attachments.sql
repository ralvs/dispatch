-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — note attachments (docs/adr/0052)
-- ─────────────────────────────────────────────────────────────────────────
--
-- The `notes.attachments` jsonb column has existed since the first schema
-- migration but nothing ever wrote to it. These two functions are the only
-- sanctioned write path.
--
-- Why functions rather than a read-modify-write from the app: appending in
-- application code means SELECT, splice, UPDATE, and two uploads landing in
-- the same instant lose one of the two. `||` and a filtered jsonb_agg do the
-- whole thing inside one statement, which is the preconditioned-write rule
-- (docs/adr/0037) applied to a jsonb array.
--
-- security invoker, so RLS on `notes` still decides who may touch which row —
-- these must not become a way around the owner boundary (iron rule #2).
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.note_attachment_add(
  p_note_id uuid,
  p_item jsonb
) returns void
language sql
security invoker
set search_path = public
as $$
  update notes
     set attachments = coalesce(attachments, '[]'::jsonb) || jsonb_build_array(p_item)
   where id = p_note_id;
$$;

create or replace function public.note_attachment_remove(
  p_note_id uuid,
  p_storage_path text
) returns void
language sql
security invoker
set search_path = public
as $$
  update notes
     set attachments = coalesce(
           (
             select jsonb_agg(item)
               from jsonb_array_elements(coalesce(attachments, '[]'::jsonb)) as item
              where item->>'storage_path' is distinct from p_storage_path
           ),
           '[]'::jsonb
         )
   where id = p_note_id;
$$;

comment on function public.note_attachment_add(uuid, jsonb) is
  'Append one attachment object to notes.attachments atomically (docs/adr/0052).';
comment on function public.note_attachment_remove(uuid, text) is
  'Drop the attachment with the given storage_path from notes.attachments (docs/adr/0052).';

-- ─────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────
