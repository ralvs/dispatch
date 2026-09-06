# The stat band is a third reading type, and it sits below the header

ADR-0042 settled what a list page's header may carry: a 36px title and a
**measure** — a figure and the word it counts, at a flat 14px. ADR-0046 added
**facts** — identity attributes, also flat. Both decisions were deliberately
quiet, so that "a list page can never out-shout the day".

`docs/plan-dispatch-shape-2026-08-21.html` §05 asks for something neither slot
can hold: a row of big figures on /routines, /domains and /tasks — kept rate,
day streak, domains gone quiet, overdue, wants parked. A count of rows is the
one fact you can already get by looking at the rows; these are not that.

## Chosen: a third reading type, in its own section below the header

`StatBand` renders a row of readings at **44px** — one ramp step under Today's
56px hero, one above the page title — each under a mono eyebrow label. It sits
**below** `PageHeader`, not inside it.

That placement is the whole decision:

- **ADR-0042 and ADR-0046 stay intact.** The title line keeps a flat 14px
  measure and flat facts. Nothing loud was added to the header.
- **The ramp still descends from Today.** 56 (Today's hero) → 44 (a stat band)
  → 36 (a page title). A list page still cannot out-shout the day, because its
  own title is the smallest of the three and the band reads as a section, not
  as the page's name.
- **The band is skippable.** A page without one loses nothing; the header is
  unchanged. This is why it is a section and not a header slot — a header slot
  would invite every page to fill it.

## What it may carry

Only a figure you cannot get by looking at the list. The plan's O2 settles the
first three pages: **/routines, /domains, /tasks**. /projects, /journal and
/notes are held until those three have been used for a while, and /people,
/quotes and /links get nothing — a pile is a pile by design (ADR-0042 already
says so about the unread count).

`attention` spends the one orange and still means what it always means — this
needs you (`DESIGN.md`, The One Orange Rule). A band of four orange figures is
the misuse this note exists to forbid.

## Rejected

- **Growing the measure.** Making the header's figures large would apply to
  every page that already has a measure, which is all of them, and would
  reopen exactly what ADR-0042 closed.
- **A stat band on every list page.** "Adding a band to a page whose numbers
  you would never read is exactly the mistake the jerad-ops 2.0 release was
  written about" (plan O2).
