-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — a recurring task is one permanent row (docs/adr/0083)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Ticking a recurring task used to close it and insert its successor as a new
-- row (docs/adr/0059), so the live task changed id every cycle. Now the
-- recurring row stays put and only its due date moves. Each tick leaves a done
-- snapshot behind: a copy of the row with no rule, `series_id` pointing at the
-- recurring row, and the due date of the cycle it fulfilled.
--
-- Three functions, one per write, so a crash can never move the date without
-- saving the history. Each one is gated on `status = open` and on the due
-- date the caller saw (docs/adr/0037): a replay finds the date already moved
-- and writes nothing. The app computes the next date (lib/recurrence.ts) and
-- passes it in; the database only does the gated writes.
--
-- security invoker, so RLS on `tasks` still decides who may touch which row
-- (iron rule #2).
--
-- Add-only (docs/adr/0065): the live code never reads `series_id` and never
-- calls these functions, so it keeps working until the new code ships.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tasks
  add column if not exists series_id uuid references public.tasks(id) on delete set null;

comment on column public.tasks.series_id is
  'On a done snapshot: the recurring task whose cycle it fulfilled (docs/adr/0083). Null on every other row.';

create index if not exists idx_tasks_series on public.tasks(series_id)
  where series_id is not null;

-- ─── Tick ────────────────────────────────────────────────────────────────
-- Insert the snapshot, then move the recurring row to its next cycle. The
-- snapshot keeps the star of the day it was ticked; the recurring row's star
-- follows it to the new due date. Returns the snapshot's id, or null when the
-- gate refused (the row moved on, is done, or does not repeat).
--
-- `p_snapshot_id` lets the client name the snapshot it already shows
-- (docs/adr/0069); null takes a fresh id.

drop function if exists public.complete_recurring_task(uuid, date, timestamptz, date, smallint, uuid);

create function public.complete_recurring_task(
  p_task_id uuid,
  p_observed_due date,
  p_completed_at timestamptz,
  p_next_due date,
  p_next_recurrence_day smallint,
  p_snapshot_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.tasks%rowtype;
  snapshot_id uuid;
begin
  select * into t
    from public.tasks
   where id = p_task_id
     and status = 'open'
     and recurrence_rule is not null
     and due_date is not distinct from p_observed_due
     for update;
  if not found then
    return null;
  end if;

  insert into public.tasks (
    id, title, notes, status, due_date, due_time, priority, project_id,
    domain_id, recurrence_rule, recurrence_day, reminder_offsets,
    reminders_sent, source, top3_for_date, completed_at, series_id
  ) values (
    coalesce(p_snapshot_id, gen_random_uuid()), t.title, t.notes, 'done',
    t.due_date, t.due_time, t.priority, t.project_id, t.domain_id, null,
    t.recurrence_day, t.reminder_offsets, t.reminders_sent, t.source,
    t.top3_for_date, p_completed_at, t.id
  )
  returning id into snapshot_id;

  update public.tasks
     set due_date = p_next_due,
         due_time = case when p_next_due is null then null else t.due_time end,
         recurrence_day = p_next_recurrence_day,
         reminders_sent = '{}'::jsonb,
         top3_for_date = case when t.top3_for_date is null then null else p_next_due end
   where id = t.id;

  return snapshot_id;
end;
$$;

comment on function public.complete_recurring_task(uuid, date, timestamptz, date, smallint, uuid) is
  'Tick a recurring task: save a done snapshot and move the row to its next cycle, gated on the observed due date (docs/adr/0083).';

-- ─── Un-tick the latest snapshot ─────────────────────────────────────────
-- The exact inverse of a tick: the recurring row takes back the snapshot's
-- due date, star, recurrence_day and reminders, and the snapshot goes. Only
-- the latest snapshot of a series can do this; an older one is history, and
-- the caller reopens it as a plain task. Returns the recurring row's id, or
-- null when this is not the latest snapshot of a live series.

drop function if exists public.untick_recurring_snapshot(uuid);

create function public.untick_recurring_snapshot(p_snapshot_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.tasks%rowtype;
  series uuid;
begin
  select * into s
    from public.tasks
   where id = p_snapshot_id
     and status = 'done'
     and series_id is not null
     for update;
  if not found then
    return null;
  end if;

  -- A later row of the same series means this one is history.
  if exists (
    select 1
      from public.tasks o
     where o.series_id = s.series_id
       and o.id <> s.id
       and (
         coalesce(o.due_date, '-infinity'::date) > coalesce(s.due_date, '-infinity'::date)
         or (o.due_date is not distinct from s.due_date and o.created_at > s.created_at)
       )
  ) then
    return null;
  end if;

  update public.tasks o
     set due_date = s.due_date,
         due_time = case when s.due_date is null then null else o.due_time end,
         recurrence_day = s.recurrence_day,
         reminders_sent = s.reminders_sent,
         top3_for_date = s.top3_for_date
   where o.id = s.series_id
     and o.status = 'open'
     and o.recurrence_rule is not null
  returning o.id into series;
  if series is null then
    return null;
  end if;

  delete from public.tasks where id = s.id;
  return series;
end;
$$;

comment on function public.untick_recurring_snapshot(uuid) is
  'Un-tick the latest done snapshot of a recurring task: move the row back to that cycle and delete the snapshot (docs/adr/0083).';

-- ─── Skip a cycle ────────────────────────────────────────────────────────
-- Move the recurring row to its next cycle with no snapshot. Same gate as a
-- tick. Returns the row's id, or null when the gate refused.

drop function if exists public.skip_recurring_task(uuid, date, date, smallint);

create function public.skip_recurring_task(
  p_task_id uuid,
  p_observed_due date,
  p_next_due date,
  p_next_recurrence_day smallint
) returns uuid
language sql
security invoker
set search_path = ''
as $$
  update public.tasks
     set due_date = p_next_due,
         due_time = case when p_next_due is null then null else due_time end,
         recurrence_day = p_next_recurrence_day,
         reminders_sent = '{}'::jsonb,
         top3_for_date = case when top3_for_date is null then null else p_next_due end
   where id = p_task_id
     and status = 'open'
     and recurrence_rule is not null
     and due_date is not distinct from p_observed_due
  returning id;
$$;

comment on function public.skip_recurring_task(uuid, date, date, smallint) is
  'Skip a recurring task''s cycle: move the row to its next cycle with no snapshot, gated on the observed due date (docs/adr/0083).';

revoke all on function public.complete_recurring_task(uuid, date, timestamptz, date, smallint, uuid) from public, anon;
revoke all on function public.untick_recurring_snapshot(uuid) from public, anon;
revoke all on function public.skip_recurring_task(uuid, date, date, smallint) from public, anon;
grant execute on function public.complete_recurring_task(uuid, date, timestamptz, date, smallint, uuid) to authenticated, service_role;
grant execute on function public.untick_recurring_snapshot(uuid) to authenticated, service_role;
grant execute on function public.skip_recurring_task(uuid, date, date, smallint) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────────────────
