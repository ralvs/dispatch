-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — atomic append to a note's body (docs/adr/0079)
-- ─────────────────────────────────────────────────────────────────────────
--
-- The MCP `update_note` tool appends a line to a note. Doing it in the app
-- (read, concatenate, write) loses one of two appends that land at once; one
-- UPDATE does the whole thing, as task_notes_append does for tasks.
--
-- No length cap: notes have none. notes.body is not null, but may be empty;
-- an empty body takes the line without a leading newline.
--
-- security invoker, so RLS on `notes` still decides who may touch which row
-- (iron rule #2). Pure addition: nothing live calls it yet.
--
-- It returns the body before and after from the same statement, so the
-- ledger's undo snapshot cannot race another write.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.note_body_append(uuid, text);

create function public.note_body_append(
  p_note_id uuid,
  p_line text
) returns table(old_body text, new_body text)
language sql
security invoker
set search_path = ''
as $$
  update public.notes n
     set body = case
           when o.old is null or o.old = '' then p_line
           else o.old || E'\n' || p_line
         end
    from (
      select id, body as old
        from public.notes
       where id = p_note_id
         for update
    ) o
   where n.id = o.id
  returning o.old, n.body;
$$;

comment on function public.note_body_append(uuid, text) is
  'Append one line to notes.body atomically; returns the body before and after (docs/adr/0079).';

revoke all on function public.note_body_append(uuid, text) from public, anon;
grant execute on function public.note_body_append(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────
