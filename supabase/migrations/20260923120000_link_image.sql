-- ─────────────────────────────────────────────────────────────────────────
-- A preview image for each link on /links (docs/adr/0066).
--
-- The URL only, never the bytes: the page hotlinks the publisher's own image
-- (og:image, a tweet's photo or video thumbnail). A dead image hides itself in
-- the UI, and the link row stays the guarantee (iron rule #4).
-- ─────────────────────────────────────────────────────────────────────────

alter table ingest_links add column if not exists image_url text;
