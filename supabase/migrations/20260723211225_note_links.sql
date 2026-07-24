-- Note ↔ {note, task, event} edges. kind='wikilink' rows are machine-synced
-- from the note body on save; kind='manual' rows are user-created attachments.
-- Event links attach to the provider series row (recurring events advance
-- start_at); remote event deletion cascades the link — the note itself survives.
create table if not exists note_links (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  target_type text not null check (target_type in ('note','task','event')),
  target_note_id  uuid references notes(id)           on delete cascade,
  target_task_id  uuid references tasks(id)           on delete cascade,
  target_event_id uuid references calendar_events(id) on delete cascade,
  kind text not null default 'manual' check (kind in ('wikilink','manual')),
  created_at timestamptz not null default now(),
  check (
    (target_type='note'  and target_note_id  is not null and target_task_id is null and target_event_id is null) or
    (target_type='task'  and target_task_id  is not null and target_note_id is null and target_event_id is null) or
    (target_type='event' and target_event_id is not null and target_note_id is null and target_task_id  is null)
  )
);
create unique index if not exists note_links_edge_uidx on note_links
  (note_id, target_type, coalesce(target_note_id, target_task_id, target_event_id), kind);
create index if not exists idx_note_links_note on note_links(note_id);
create index if not exists idx_note_links_target_note  on note_links(target_note_id)  where target_note_id  is not null;
create index if not exists idx_note_links_target_task  on note_links(target_task_id)  where target_task_id  is not null;
create index if not exists idx_note_links_target_event on note_links(target_event_id) where target_event_id is not null;
alter table note_links enable row level security;

drop policy if exists note_links_authenticated_all on note_links;
create policy note_links_authenticated_all on note_links
  for all to authenticated using (true) with check (true);
