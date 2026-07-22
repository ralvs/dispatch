-- Google Calendar pull-only (docs/adr/0018). Multi-provider identity + sync state.

-- ── calendar_events.source: add 'google' ───────────────────────────────────
alter table calendar_events drop constraint if exists calendar_events_source_check;
alter table calendar_events
  add constraint calendar_events_source_check
  check (source in ('caldav', 'google', 'created_here'));

-- ── Identity: composite unique (source, caldav_uid) ───────────────────────
-- Global unique on caldav_uid alone collides when Google iCalUIDs match
-- iCloud invites for the same meeting. Columns keep caldav_* names as
-- provider-agnostic remote keys (rename to external_* is a later cleanup).
alter table calendar_events drop constraint if exists calendar_events_caldav_uid_key;
drop index if exists calendar_events_caldav_uid_key;

create unique index if not exists calendar_events_source_caldav_uid_uidx
  on calendar_events (source, caldav_uid);

-- ── google_sync_state singleton (service-role only; RLS, no policies) ─────
create table if not exists google_sync_state (
  id boolean primary key default true check (id),
  last_synced_at timestamptz,
  last_result jsonb
);

alter table google_sync_state enable row level security;
