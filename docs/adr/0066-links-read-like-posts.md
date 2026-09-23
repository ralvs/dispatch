# Links read like posts: an X provider and a hotlinked preview image

Date: 2026-09-23

## Context

Most links saved to /links are X posts. With the generic head scrape
(ADR-0022, ADR-0026) each one arrived like this:

- title "Gregor Zunic (@gregpr07) on X" — or "⃟ (@anishfn) on X" when the
  display name is a symbol;
- description the post text with raw `https://t.co/…` links in it, or only a
  t.co link, or nothing at all for a long post;
- a second line with the full URL, tracking query and all, plus the source.

Nobody could tell from the list what any post said. No prompt is involved:
links never touch the capture parser, so the fix is in the fetcher and the
row, not in a prompt.

## Decision 1 — X posts ask FxTwitter first

`fetchLinkMetadata` sends `x.com` / `twitter.com` status URLs to FxTwitter's
keyless API (`api.fxtwitter.com/{handle}/status/{id}`). It returns the full
text with t.co links expanded and media links removed, the author, and the
media. Title becomes "Name (@handle)" — just "@handle" when the name has no
letter or digit — and the description is the post text, line breaks kept.

This is the ADR-0026 seam and bar: X is broken without a provider. X's own
oEmbed returns HTML with t.co links and no media, so it would not fix it.

FxTwitter is a third party. It sees only a public post URL, and it fails like
every other provider here: a non-OK answer or a body that is not a post
returns null, and X's own head gets its turn. That fallback is tidied — the
" on X" tail and t.co links go — so an outage costs the image and the long
text, not readability.

## Decision 2 — a preview image, hotlinked, never stored

`ingest_links.image_url` holds the URL of the publisher's image: `og:image`
(secure_url first, then `twitter:image`) from the head, YouTube's oEmbed
`thumbnail_url`, a post's photo, or a video's thumbnail. Only absolute https
URLs are kept; a relative one resolves against the page's final URL.

The page loads it straight from the publisher with `referrerPolicy="no-referrer"`
and `loading="lazy"`, and hides it on error. Not proxied through
`next/image`: that would bill optimizer transforms for thumbnails that are
viewed once, and would need an open `remotePatterns` for every host a link
can point at. Not copied to storage: a reading list is triaged and discarded,
so an image that expires with its post is acceptable.

## Decision 3 — the row shows words, not the URL

The row keeps the title, shows up to three lines of description at body
reading size, and replaces the raw URL + source line with the host alone. The
source ("webhook", "share_sheet") stays in the table; the list has no use
for it.

## Consequences

- `parseMetadata(html, base)` now takes the page's final URL, not its host.
- `LinkMetadata` and `updateLinkMetadata` carry `image`.
- Links saved before this keep their old metadata until
  `bun run backfill:links --write` re-reads them. It is a dry run without
  `--write`, and a field the fetcher cannot resolve keeps its old value.
