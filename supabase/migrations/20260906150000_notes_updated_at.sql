-- Notes get an updated_at stamp, so editing a note revives its domain.
--
-- The neglect sweep (lib/services/observations.ts) folds notes into a
-- domain's last touch. Until now it could only read created_at, so a note
-- written a year ago and edited this morning still read as a year of silence
-- — and filing an existing note into a domain did not count as touching that
-- domain at all. Attention is what the measure is for, and an edit is
-- attention.
--
-- Backfilled to created_at rather than now(): a note nobody has edited was
-- last touched when it was written, and stamping every row with the migration
-- time would quietly un-quiet every domain at once.
--
-- The trigger is the existing set_updated_at() from the initial schema, so
-- notes behave exactly like projects and domains: any UPDATE re-stamps the
-- row, and no service has to remember to do it.

-- Added nullable, backfilled, then constrained: a column default cannot
-- reference another column, and filling only the NULLs keeps a re-run of this
-- migration from resetting rows that have legitimately been edited since.
alter table notes add column if not exists updated_at timestamptz;

update notes set updated_at = created_at where updated_at is null;

alter table notes
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists trg_notes_updated_at on notes;
create trigger trg_notes_updated_at
  before update on notes
  for each row execute function set_updated_at();
