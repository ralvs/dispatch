-- Domain color: a per-domain swatch rendered wherever a domain name appears,
-- mirroring projects.color. Validation stays Zod-side (as it is for projects)
-- so the curated palette can change without a migration. RLS is granted at the
-- table level, so a new column needs no policy change.
alter table stewardship_domains add column if not exists color text;
