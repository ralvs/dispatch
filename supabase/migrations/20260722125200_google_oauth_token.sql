-- Store Google OAuth refresh token on the existing sync singleton (docs/adr/0018).
-- Service-role only (RLS already enabled, no policies). calendar.readonly scope only.

alter table google_sync_state
  add column if not exists refresh_token text,
  add column if not exists account_email text,
  add column if not exists connected_at timestamptz;
