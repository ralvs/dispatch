-- @mention People (docs/adr/0030). Polymorphic on the source side — a task
-- or a note can mention a person — mirroring note_links' one-column-per-type
-- CHECK idiom rather than extending note_links itself (Decision 1). Carries
-- matched_name, the verbatim text that resolved, so a later person rename
-- can be repaired instead of guessed at.
create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  source_type text not null check (source_type in ('task','note')),
  matched_name text not null,
  created_at timestamptz not null default now(),
  check (
    (source_type='task' and task_id is not null and note_id is null) or
    (source_type='note' and note_id is not null and task_id is null)
  )
);

-- A person can be mentioned once per source (Consequences) — partial so the
-- unused source column (always null) never collides across rows.
create unique index if not exists mentions_task_uidx on mentions(task_id, person_id) where task_id is not null;
create unique index if not exists mentions_note_uidx on mentions(note_id, person_id) where note_id is not null;

-- "Mentioned in" panel on /people/[id] (Consequences), newest first.
create index if not exists idx_mentions_person on mentions(person_id, created_at desc);

alter table mentions enable row level security;

drop policy if exists mentions_authenticated_all on mentions;
create policy mentions_authenticated_all on mentions
  for all to authenticated using (true) with check (true);
