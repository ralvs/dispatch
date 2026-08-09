# The page header is the fine locator, and it carries a measure

Every surface except Today opened with the same three-part stack: a mono
eyebrow naming the page, a `font-serif` display line naming it again more
decoratively, and a strong hairline under both. It appeared in 28 files, and 13
`loading.tsx` files restated their own page's copy of it by hand.

Today replaced its own version during the revision A build and could not answer
what the others should do: Today has no page header at all. Its `h1` is
`DayHeadline`, a sentence about the day, and its dateline is the day nav. So the
question was opened deliberately at a gate in Pass 0, drawn four ways over
`/projects`, `/notes` and `/inbox` in `.impeccable/mocks/chrome-header-lab.html`.

## The decision

**Option D — headline, measured.** `components/ui/page-header.tsx`.

- **Title** at 36px / 500 / −0.9px, one ramp step below Today's 56px hero, so a
  list page can never out-shout the day. 30px on a phone.
- **Measure** on the title's baseline, right-aligned: `14 open  3 paused`, in
  Today's counters idiom stepped down to a flat 14. The figure is 500 at
  `ink-2`, the word 400 at `ink-3`.
- **Action** beside it, centred and nudged 3px so its cap-height rides the
  title's baseline.
- **Subtitle** beneath, only where it carries an instruction.
- **No divider.** The 64px `AppHeader` already puts above the header is the
  separation.

At 393pt the title keeps its own line and the measure and action take the one
below, rather than the measure shrinking.

**Refined in Pass 1:** that wrap is keyed to the *measure*, not to the
breakpoint. A measure is running text and needs the width. An action on its own
does not — a 32px control wrapping below a 30px title leaves a band of empty
ground with one circle floating in it, and the control changes its relationship
to the title depending on window width. So an action-only header never wraps: it
holds the title's line at every width, centred on it, and the `h1` gives up the
room. `/tasks` is the only page in that shape today; every other action-carrying
page has a measure and is unaffected.

## Why the header is not redundant on desktop

The brief that opened the gate assumed the desktop tab group already names the
page, which would make a title beneath it a repetition, and that the phone —
which has only the dock — might need a name the desktop did not. One measured
fact killed both halves: the tab group has five tabs and **eight of the twelve
pages sit behind More**, so on `/projects` the active pill reads "More", which
names nothing. The tab group is a coarse locator; the page header is the fine
one. There is no desktop/phone asymmetry to carry, and the only open question
was how much room the name gets — which is the single axis the four options
moved along.

## What the decision deletes

- **The eyebrow above a heading.** The mono eyebrow stays alive everywhere it is
  a system label — the day nav's dateline, the tape's heading, a card's section
  label. It never sits above a heading again, where it said the page's name
  twice in two voices.
- **The second title.** "What's in motion", "Loose thoughts", "The docket", and
  nine more. A display line that renames the page is a mood, not information.
- **The rule.** The last piece of the legacy silhouette still standing.
- **`.font-serif`.** It set no family through three identities; what it actually
  did is now `.type-title`. Deleting `--font-serif` and every call site had to
  happen together — Tailwind v4 generates the utility from the theme variable,
  so removing the variable alone would have handed surviving call sites a real
  ui-serif.

## Consequences

`PageHeader`, `PageSkeleton`, `SectionHead` and `EmptyState` are in
`components/ui/`. `PageSkeleton` renders the real `PageHeader`, so a route's
loading state cannot drift from the route again; it carries no measure, because
the count is the data and a placeholder figure would be the one thing on screen
that lies.

`EmptyState` settles a conflict rather than inventing anything: the linen era
centred its empties in a serif italic, Today left-aligns them on the row edge,
and Today wins. The italic survives the loss of the serif — it is what separates
a sentence the app is saying from a title a person wrote.

**`ListRow` was specified for this pass and deliberately not built.** The pass
touches headers, skeletons and empty states only, so it would have shipped with
zero call sites, and the geometry should be derived from the rows it has to
serve. Pass 1 settles the task row; Pass 2 extracts the shared geometry with
three real callers in hand.

**`/tasks` is the one open seam.** It took the header and the skeleton and
nothing else, because its status strip (`open · overdue · today`, with counts)
is a reading that is also the filter, in the same mono idiom the measure slot
uses. On eleven pages a mono count is informational; there it is a control.
Pass 1 resolves it from comps of the whole page — see
`.impeccable/BUILD-TASKS.md`.

→ Chosen at the Pass 0 gate, commit `ccf2c55`. Brief: `.impeccable/BUILD-CHROME.md`.
