-- ─────────────────────────────────────────────────────────────────────────
-- Link Ingest — the reading list behind /ingest (docs/adr/0014).
--
-- Purpose-built rather than overloaded onto `notes`: a link carries a read
-- state and a provenance, and it is triaged-then-discarded rather than
-- authored and kept. The "Link Inbox" note seeded by 0001 predates this
-- decision and is deliberately left in place — it is the owner's data.
--
-- Distinct from text capture: `POST /api/ingest` still writes captured_data
-- and runs the LLM parser. Links never touch that path.
--
-- RLS matches every other single-owner table: authenticated does everything,
-- and the secret-authed link API writes with the service-role key.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists ingest_links (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  description text,
  status text not null default 'unread'
    check (status in ('unread','read','dismissed')),
  -- Where it came from, e.g. 'share_sheet', 'api'. Free text by design.
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The list view (status filter, newest first) and the unread badge count.
create index if not exists idx_ingest_links_status_time
  on ingest_links (status, created_at desc);

drop trigger if exists trg_ingest_links_updated_at on ingest_links;
create trigger trg_ingest_links_updated_at
  before update on ingest_links
  for each row execute function set_updated_at();

alter table ingest_links enable row level security;
drop policy if exists ingest_links_authenticated_all on ingest_links;
create policy ingest_links_authenticated_all on ingest_links
  for all to authenticated using (true) with check (true);
