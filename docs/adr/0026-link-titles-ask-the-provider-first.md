# Link titles ask the provider first, and lose the masthead

Date: 2026-07-26

## Context

ADR-0022 gave shared links a title by reading `og:title` / `<title>` out of the
page head. Two months of real captures show where that is not enough.

A YouTube link saved as a bare `youtube.com`. YouTube answers a plain GET with
a JS shell: no `og:title`, no usable `<title>`. The reading list showed the
host and nothing else — for the one kind of link where the title *is* the
content.

Article links fared better but still arrived as page titles rather than
headlines: "Neuromancer - Wikipedia", "How the deal fell apart | Reuters". The
masthead is noise in a list where every row is already a link.

## Decision 1 — oEmbed before scraping, for providers that have it

`fetchLinkMetadata` checks for a provider endpoint before fetching the page.
YouTube (`youtube.com`, `youtu.be`, and the `m.`/`music.` hosts) has a keyless
oEmbed endpoint that answers for watch, shorts, live and short-link URLs alike:
`title` is the video's own title, `author_name` the channel, which becomes the
description.

It fails the same way everything else in this file does. A declining endpoint
(private video, deleted, not a video URL) returns `null` rather than empty
metadata, so the generic HTML path still gets its turn, and that path still
degrades to nulls. The link saves either way (iron rule #4).

Only YouTube is wired up. The seam (`oembedEndpoint`) takes a URL and returns
an endpoint or null, so adding a provider is one entry — but a provider earns
its entry by actually being broken without it, not by having an endpoint.

## Decision 2 — strip the masthead, but only when it is the masthead

Whichever title source wins, a trailing `" — Site"` / `" | Site"` is dropped
when the tail matches the site's declared name (`og:site_name`,
`application-name`) or a brand label in the hostname (`en.wikipedia.org` →
"Wikipedia"). Comparison is on a normalised brand: lowercased, punctuation
gone, a leading "The" ignored.

The guard is the point. "Rust 2.0 — what changed and why" keeps both halves
because "what changed and why" is nobody's masthead, and "Home | Reuters"
keeps its suffix because stripping would leave a five-character stub. A false
negative leaves a slightly noisy title; a false positive eats the headline, so
the rule only fires on a match it can name.

Host brand extraction is approximate — drop the last label, drop a `co`-style
public suffix, ignore `www` and two-letter labels. It is not a public-suffix
list and does not need to be: a wrong candidate matches nothing.

Titles from oEmbed skip this. The provider is stating the title, not
decorating a page with it, so "Neuromancer — Official Teaser | Apple TV" stays
whole.

## Consequences

- `parseMetadata` takes an optional host as its second argument, supplied from
  the *final* URL after redirects. Called without it, the site-name metas still
  work and only host-based stripping is lost.
- The reading list now shows video titles and headlines. Nothing about the
  storage or the capture contract changed.
