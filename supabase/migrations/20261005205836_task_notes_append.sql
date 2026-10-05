-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — atomic append to a task's notes (docs/adr/0079)
-- ─────────────────────────────────────────────────────────────────────────
--
-- The MCP `update_task` tool appends a line to a task's notes. Doing it in the
-- app (read, concatenate, write) loses one of two appends that land at once;
-- one UPDATE does the whole thing, the same reasoning as note_attachment_add
-- (docs/adr/0052, docs/adr/0037).
--
-- The length cap is part of the write: a line that would push the notes past
-- p_max updates nothing and returns no row, so the caller can tell the owner
-- why rather than truncate.
--
-- security invoker, so RLS on `tasks` still decides who may touch which row
-- (iron rule #2). Pure addition: nothing live calls it yet.
--
-- It returns the notes before and after from the same statement, so the
-- ledger's undo snapshot cannot race another write.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

drop function if exists public.task_notes_append(uuid, text, int);

create function public.task_notes_append(
  p_task_id uuid,
  p_line text,
  p_max int
) returns table(old_notes text, new_notes text)
language sql
security invoker
set search_path = ''
as $$
  update public.tasks t
     set notes = case
           when o.old is null or o.old = '' then p_line
           else o.old || E'\n' || p_line
         end
    from (
      select id, notes as old
        from public.tasks
       where id = p_task_id
         for update
    ) o
   where t.id = o.id
     and char_length(
           case
             when o.old is null or o.old = '' then p_line
             else o.old || E'\n' || p_line
           end
         ) <= p_max
  returning o.old, t.notes;
$$;

comment on function public.task_notes_append(uuid, text, int) is
  'Append one line to tasks.notes atomically, refusing past p_max characters; returns the notes before and after (docs/adr/0079).';

revoke all on function public.task_notes_append(uuid, text, int) from public, anon;
grant execute on function public.task_notes_append(uuid, text, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────
