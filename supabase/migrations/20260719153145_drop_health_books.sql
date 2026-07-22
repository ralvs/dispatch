-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — scope cut: drop the health subsystem and the books shelf
-- (docs/adr/0011). Journal stays.
--
-- DESTRUCTIVE: any rows in these tables are gone once this runs. Apply
-- deliberately.
-- ─────────────────────────────────────────────────────────────────────────

-- Quotes lose their FK into books before books goes away.
alter table quotes drop column if exists book_id;

-- Referencing tables first, referenced tables after.
drop table if exists health_documents;
drop table if exists lab_results;
drop table if exists health_metrics;
drop table if exists lab_panels;
drop table if exists wellbeing_check_ins;
drop table if exists medications;
drop table if exists workouts;
drop table if exists health_history;
drop table if exists health_visits;
drop table if exists books;
