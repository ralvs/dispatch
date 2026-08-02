# `Today*` is locked to today; `Day*` follows the picker

Date: 2026-08-02

Names the Today page's parts. Supersedes the vocabulary — not the decisions —
of [ADR-0010](./0010-briefing-two-column-redesign.md),
[ADR-0014](./0014-ops-shell-day-schedule-link-ingest.md),
[ADR-0033](./0033-cache-components-and-tagged-data.md) and
[ADR-0034](./0034-the-client-owns-navigation-freshness.md).

## Context

Five names had accumulated for two-and-a-half concepts, and three of them
overlapped badly enough that reading a diff required checking which one was
meant.

**`briefing` was a second word for `Today`.** `lib/services/briefing.ts`
exported `BriefingView` / `getBriefing` / `assembleBriefing`, and
`BriefingBody` *was* the Today page. Two vocabularies, one thing. Worse, the
page also has a real section called "In brief" (`BriefSection`, `BriefLine`) —
one small list of domains past their cadence. So `brief` and `briefing` named
things at completely different scales.

**`chrome` was a lie.** `CacheTag.todayChrome` and `loadBriefingChrome` meant
"the cold, cross-request-cached half of Today's data" — quotes, projects,
routines, domain cadence, alert counts. Everywhere else in this codebase and
in the industry, *chrome* means UI frame; `components/nav-links.ts` uses it
that way in the same breath ("System is chrome"). Nothing about the cached
segment is chrome.

**`DaySchedule` named three different things.** `DayScheduleSection` (the
client component owning `?d=` and the day cache), `DaySchedule` (the component
inside it rendering the bands), and `DaySchedule` (the data type). Outer,
inner, and payload, all one word.

## Decision

**The prefix carries the date semantics.** This is the whole rule:

> `Today*` is locked to the real calendar today.
> `Day*` follows the date picker (`?d=`), so it is not necessarily today.

That distinction is the one that actually matters on this page: everything is
pinned to today *except* the schedule, which navigates. Encoding it in the
prefix means a name can no longer hide which side it is on.

| Name | What it is |
|---|---|
| `Today` | the route and page (`/today`, nav label) |
| `TodayView` | all data the page renders — digest plus today's schedule |
| `TodayDigest` | the cold half: quotes, projects, routines, cadence, alert counts. Cross-request cached, tag `today-digest` |
| `DaySchedule` | **data only** — tasks + events for one date, in four bands |
| `DayView` | the UI region owning day navigation, `?d=`, and the day cache |
| `DayBands` | the four lists: All day / Timeline / Top 3 / Open |
| `DayTape` | the ruler above them |
| `DayNav` | the chevrons |
| `BriefLine` / `BriefSection` | the "In brief" cadence rows — one section, nothing more |

`briefing` and `chrome` are retired as domain terms. `chrome` returns to
meaning UI frame, which is how the nav already used it.

### Why `digest` and not `overview`

`TodayOverview` sat next to `TodayView` and read as the same word twice — it
restated the collision it was meant to fix. `digest` is unambiguous against
`view`, and it matches the editorial vocabulary the page already speaks:
masthead, dateline, In brief.

### Why `DaySchedule` survives as the type

It is the one name in the old set that was accurate. Freeing it required
renaming the two components that had borrowed it, not the type itself.

## Consequences

- The cache tag string changes `today-chrome` → `today-digest`. Tags are
  ephemeral; a deploy straddling the change leaves the old entries to expire
  on their own `cacheLife` (600s) rather than being busted. Harmless for a
  single-user app.
- `lib/services/briefing.ts` → `lib/services/today.ts`,
  `lib/cache/briefing.ts` → `lib/cache/today.ts`. The service module header
  carries the table above, so the vocabulary is one hop from any call site.
- `timeline-row.tsx` → `schedule-row.tsx`, matching its `ScheduleRow` export —
  it always served both the All day and Timeline bands, so the file name was
  the narrower of the two.
- ADRs 0010, 0014, 0033 and 0034 keep their original wording as historical
  record. Each now carries a pointer here. Read their terms through this
  table: their `briefing` is this `TodayView`, their `chrome` this
  `TodayDigest`.
- No behavior, query, or rendering change. `bun run check` green across 570
  tests with no test-body edits beyond the renamed imports.
