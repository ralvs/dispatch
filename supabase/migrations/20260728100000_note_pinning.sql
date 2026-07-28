-- Note pinning (docs/adr/0012 amendment): pin the notes that matter to the
-- top of /notes, alongside the needs-review queue. A timestamp rather than a
-- boolean so pin ORDER is stable — the same reasoning as tasks.top3_for_date,
-- which stores a date rather than a flag so "when" survives, not just "if".
-- Null means unpinned; a set value both marks the note pinned and orders it
-- among other pinned notes (most-recently-pinned first).
alter table notes add column if not exists pinned_at timestamptz;

create index if not exists idx_notes_pinned on notes (pinned_at desc) where pinned_at is not null;
