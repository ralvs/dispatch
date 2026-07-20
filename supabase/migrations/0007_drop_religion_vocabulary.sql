-- ─────────────────────────────────────────────────────────────────────────
-- Drop church / sermon / verse vocabulary (religion-specific enums).
-- Spirituality remains a stewardship domain — it is not religion.
-- Safe to re-run. Existing rows are remapped before CHECK constraints tighten.
-- ─────────────────────────────────────────────────────────────────────────

-- People: church → other
update people
set relationship_type = 'other'
where relationship_type = 'church';

alter table people drop constraint if exists people_relationship_type_check;
alter table people
  add constraint people_relationship_type_check
  check (relationship_type is null or relationship_type in
    ('client','family','friend','team','vendor','other'));

-- Quotes: sermon → other
update quotes
set source_type = 'other'
where source_type = 'sermon';

alter table quotes drop constraint if exists quotes_source_type_check;
alter table quotes
  add constraint quotes_source_type_check
  check (source_type is null or source_type in
    ('book','article','podcast','video','conversation','other'));

-- Resurfacing ledger: drop verse rows, then drop the enum value
delete from resurfacing_seen where item_type = 'verse';

alter table resurfacing_seen drop constraint if exists resurfacing_seen_item_type_check;
alter table resurfacing_seen
  add constraint resurfacing_seen_item_type_check
  check (item_type in
    ('journal','quote','win','note','project_milestone'));
