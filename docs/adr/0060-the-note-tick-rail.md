# The note tick rail copies Grok.com’s dashes

Date: 2026-09-07

`/notes/[id]` grows a compact stack of short horizontal dashes on the right
edge of the note article — one dash per top-level block (title, heading,
paragraph, list). Hover shows a snippet pill. Chevrons jump previous/next.

## Why

A long note needs a way to jump sections without a TOC. Grok.com’s chat tick
rail is the visual contract (the owner’s screenshots). It is not a scrollbar,
not a minimap, and not a sibling column.

## Decision

- Dashes, ~16×2px. Active ~3px thick. Never taller than 8px.
- Inside the note article, right padding, desk only (`lg+`). Hidden when the
  note has fewer than two blocks or fits the viewport.
- One tick per top-level block. Empty paragraphs excluded. Do not merge a
  heading with the paragraphs under it.
- `#main` is the scroller. The page scrollbar and the links rail are untouched.

## Consequences

The page grid does not gain a column. QA is a side-by-side with grok.com.
