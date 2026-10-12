-- One row stands for a whole iCloud series (lib/caldav/ical.ts), so an edit
-- or delete through Dispatch must refuse a series (docs/adr/0082). Null means
-- "not known yet": the next CalDAV sync rewrites every row whose flag is null,
-- and until then the row is not editable. Add-only (docs/adr/0065).
alter table calendar_events add column if not exists recurring boolean;
