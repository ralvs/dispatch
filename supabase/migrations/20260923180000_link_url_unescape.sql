-- ─────────────────────────────────────────────────────────────────────────
-- Links saved from the share sheet arrived HTML-escaped: "?s=12&amp;t=…".
-- POST /api/capture now un-escapes them (bareUrl); this fixes the rows saved
-- before that. A literal "&amp;" is never part of a real query string, so the
-- rewrite is safe, and it is idempotent.
-- ─────────────────────────────────────────────────────────────────────────

update ingest_links
set url = replace(url, '&amp;', '&')
where url like '%&amp;%';
