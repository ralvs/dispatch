# The note tick rail copies Grok.com’s dashes

Date: 2026-09-07 (revised 2026-09-11)

`/notes/[id]` grows a compact stack of short horizontal dashes in the right
gutter of the viewport — one dash per top-level block (title, heading,
paragraph, list). Hover shows a snippet pill. Chevrons jump previous/next.

## Why

A long note needs a way to jump sections without a TOC. Grok.com’s chat tick
rail is the visual contract (the owner’s screenshots). It is not a scrollbar,
not a minimap, and not a sibling column.

## Decision

- Dashes, 14×2px. Active 24×3px. Never taller than 8px.
- **Fixed to the viewport, vertically centred, right gutter.** The first pass
  put the rail inside the note article with a `sticky` child; a sticky element
  can only travel inside its own parent’s box, and that parent was sized to its
  content, so the rail never moved. Desk only (`lg+`). The inset is 8px up to
  `xl` and 20px above it: at exactly 1024px the frame's 44px padding is all the
  room there is, and the links column ends 12px short of the dashes. The gutter
  widens fast — by 1440px the rail sits in open space.
- One tick per top-level block. Empty paragraphs excluded. Do not merge a
  heading with the paragraphs under it.
- `#main` is the scroller. The page scrollbar and the links rail are untouched.
- The active dash is the block crossing the reading line at 35% of the
  scroller. At the bottom of the note the last dash wins, because no block
  below the line can ever reach it.
- Block positions are read fresh inside one `requestAnimationFrame` per scroll,
  never cached. A font swap or a streamed-in panel moves the blocks without
  resizing the article, and a cached offset then points at the wrong paragraph.
- More blocks than the rail is tall: show a window centred on the active dash,
  clamped so the first and last blocks stay reachable.
- Hidden when the note has fewer than two blocks, or when the run from the
  first indexed block to the last fits the scroller. Measured across the blocks
  and not the article, whose source line, domain select and Delete button would
  otherwise grow a rail on a two-paragraph note.
- The rail is last in the article's DOM so the note takes focus first; `fixed`
  makes its position independent of order. The chevrons stay mounted and
  tabbable, revealed on hover or on focus landing anywhere in the rail — an
  invisible focusable control is a trap. Focus on a dash shows its pill.

## Consequences

The page grid does not gain a column. Geometry and the scroll mapping are pure
functions in `lib/note-ticks/layout.ts` and unit-tested; the component only
wires them to the DOM. QA is a side-by-side with grok.com.
