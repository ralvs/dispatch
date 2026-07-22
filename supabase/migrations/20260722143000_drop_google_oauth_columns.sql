-- OAuth path abandoned (Workspace admin blocks third-party apps).
-- Work events now arrive via Mac EventKit bridge (docs/adr/0018).
-- Keep google_sync_state for last_synced_at / last_result; drop token columns.

alter table google_sync_state
  drop column if exists refresh_token,
  drop column if exists account_email,
  drop column if exists connected_at;
