-- ─────────────────────────────────────────────────────────────────────────
-- Link a note back to the raw capture it was degraded from.
--
-- The never-lose capture pipeline (docs/adr/0008) degrades any failure to a
-- `needs_review` note. Recording which `captured_data` row that note came from
-- lets the future reconciliation sweep dedupe: before degrading an orphaned
-- (still-`raw`) capture, it checks for an existing note linked to it and skips
-- if one is already there, so a crash-then-sweep can't create a duplicate note.
-- ─────────────────────────────────────────────────────────────────────────

alter table notes
  add column if not exists origin_capture_id uuid
    references captured_data(id) on delete set null;

create index if not exists idx_notes_origin_capture
  on notes(origin_capture_id) where origin_capture_id is not null;
