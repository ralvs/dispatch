# A skeleton is the page's silhouette

Date: 2026-10-02

No route's loading state looked like the page it loaded. `PageSkeleton` drew
the real header and then six to eight full-width bars, the same on every list
page. The bars were `bg-surface` — white on the `#fafafa` ground — so on most
screens they did not show at all. `/today` went the other way: its
`loading.tsx` drew three large slabs, and its in-page fallback printed
"Reading the day…" over one more. The detail pages and the note editor had
their own hand-made bars. When the data landed, everything below the header
changed shape.

## Decision

1. **Each route's fallback is that route's own silhouette.** It sits next to
   the page (`TasksFallback` in `tasks/page.tsx`, `TodaySkeleton` in
   `today/`), and it draws the same sections in the same order: the stat
   band, the filter strip, the section heads, and rows with the real row's
   parts — checkbox, domain dot, title over meta, star, pills, the routine
   strip.
2. **The parts live in `components/ui/page-skeleton.tsx`.** `TextBone` is one
   line box (`1lh`) at the type class it is given, so a bone row is as tall as
   the text row. `Bone`, `CheckboxBone`, `DotBone`, `PillBone`, `TriggerBone`,
   `StatBandBone`, `SectionBone`, `MeasureBone` and `TitleMetaBone` cover the
   rest. Rows reuse `ListRow`, so the hairline, padding and gap are the real
   ones.
3. **Bones are `bg-surface-2`.** It is the tone Today's empty tape track uses.
4. **Static parts render for real.** The header title, a standing action
   (disabled), the back link and Today's dateline are not data, as before
   (ADR-0042).
5. **The measure gets a bar, never a figure.** DESIGN.md's rule stands: a
   placeholder count lies. A grey bar holds the slot without a number.
6. **Every fallback keeps one `role="status"` reading "Loading".** The
   end-to-end skeleton smoke waits for it to leave (ADR-0063).

`SkeletonRows` is gone. `/today`'s `loading.tsx` and its Suspense fallback now
render the same `TodaySkeleton`; only the fallback prints the dateline, because
`loading.tsx` renders before the timezone is known.

## Consequences

- A route that changes its layout should change its fallback in the same PR.
  The fallback sits in the same file, so the diff shows both.
- Row counts are a guess (three to eight). They describe a typical page, not
  this one; the shape matters more than the count.
