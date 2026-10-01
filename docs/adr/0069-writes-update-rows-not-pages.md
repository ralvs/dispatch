# Writes update rows, not pages

Date: 2026-10-01

Every write used to re-render the page it was made from and wipe the whole
client router cache. `afterMutation` called `revalidateTag` **and**
`revalidatePath`, and `SoftRefresh` called `router.refresh()` every five
minutes on Today. Decided 2026-09-22 (#24): the whole-page refresh goes.

## Supersedes

- ADR-0035's rule that a write carries a path.
- The parts of ADR-0034 that assume a page render after every write.
- The `SoftRefresh` item in ADR-0062's "Deliberately not done".
- The Next 16.2.10 claims in the old `lib/mutation-feedback/invalidate.ts`
  header.

The old ADRs are left as written.

## The Next 16.3.5 facts

Checked in the installed source:
`node_modules/next/dist/server/web/spec-extension/revalidate.js:54-84,219-223`
and `client/components/router-reducer/reducers/server-action-reducer.js:218-235`.

| Called from a server action | Revalidation kind | What the client does |
|---|---|---|
| `revalidateTag(tag, "max")` | none | Re-renders nothing, wipes nothing. The next server read of that tag serves the pre-write entry once. |
| `updateTag(tag)` | StaticAndDynamic | Re-renders the page from the root, wipes the BFCache and the prefetch cache. |
| `revalidatePath(path)` | StaticAndDynamic | Same as `updateTag`. |
| `refresh()` | DynamicOnly | Re-renders the page and wipes the BFCache. |

So Next cannot refresh "only what changed": every read-your-writes API wipes
the whole client cache. The reducer says so itself: *"Evict only segments with
matching tags and/or paths."*

## Decision

1. **The browser holds the truth for the rows it wrote** — the client entity
   store (`lib/store`, #25). Pages seed it; an intent applies optimistically;
   the action's returned rows confirm it; a failure rolls it back.
2. **The conflict rule** (`lib/store/types.ts`): a version is the server
   instant a state was observed. A seed's version is its `readAt`, stamped
   before the read (inside `"use cache"` for cached readers); a write's is its
   `at`, stamped after it commits. A confirmed write replays onto every seed
   older than it. So a stale read never overwrites a fresher write, a later
   read replaces a confirmed one, and the one stale read `revalidateTag` serves
   after a write is harmless.
   - Tables without `updated_at` (`quotes`, `journal_entries`,
     `person_facts`, `person_interactions`) need nothing extra: the rule does
     not use `updated_at` at all. Edits are desired-state patches;
     interactions are inserted or deleted.
3. **Counts that span rows the client never loaded are store aggregates**,
   seeded by the page that shows them and moved by the intents that change
   them: Today's counters, the masthead badge, the review count, and each
   project's done and open counts (`project.done:<id>`, `project.open:<id>`).
4. **`afterMutation` busts tags only**, with `revalidateTag(tag, "max")`. No
   action response carries a page render.
5. **The `updateTag` exception.** A write the store cannot confirm uses
   `updateTag` and accepts the cache wipe: the settings timezone and
   reminders and a note's link rail (`note_links`, which the store does not
   hold) — all rare — and a palette capture, which is not rare: the parser
   decides which rows it writes, so the client has nothing to apply. Moving
   capture onto the store means returning the rows the executor wrote; until
   then, a capture costs one page render. Theme is a cookie and needs neither.
6. **`SoftRefresh` pulls Today into the store** (`pullTodayAction`, #4) every
   five minutes and on return to a hidden tab: the bands of the day on screen,
   the counters and the alerts beside them (inbox, review, unread), the badge,
   the routines card, the project rings. It is how a cron's write
   reaches an open tab. When the server's today is past the page's, it calls
   `router.refresh()` once — the day rollover, at most once a day.
7. **Pickers fold this tab's confirmed writes onto their server lists**
   (`lib/store/live-options.ts`): @-mention people, the task dialog's domains
   and projects. A row created here is offered at once although the list was
   read from a cache one request behind.
8. **`staleTimes.dynamic` stays 300s.** It used to be safe because any write
   wiped the cache. It is now safe because a cached page's seed replays every
   confirmed write newer than it. Only the crons and the capture webhook can
   drift, up to five minutes — and Today pulls on the same cadence.

## Measured (#4)

Production build, local database. Navigation from Today to `/tasks` and
`/notes`, warm (immediately after visiting them) and after six minutes on
Today. Before: `router.refresh()` and `revalidatePath`. After: this ADR.

MEASUREMENTS_TABLE

## Consequences

- An action that changes a row returns `ActionResult<StoreWrite<Row>>`, built
  with `stampWrite`. AGENTS.md says so.
- A new list reads the store, or its writes will not show until the next
  navigation.
- Known gaps: a project's status change does not move Today's projects card
  (which projects are active comes from the digest); an edit made in this tab
  keeps winning in a picker over a later edit made elsewhere, for the life of
  the tab.
- What would simplify this: per-tag client eviction in Next — the reducer's
  TODO. With it, `revalidateTag` could also evict the client entries that read
  a tag, and the store would only be needed for optimistic state.
