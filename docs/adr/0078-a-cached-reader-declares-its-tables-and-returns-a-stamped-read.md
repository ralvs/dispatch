# A cached reader declares its tables and returns a stamped read

Date: 2026-10-04

Every cached reader carried a hand-written list of the mutation kinds and
external writers that moved its data (`lib/cache/manifest.ts`). The test only
checked that each listed writer busted the tag; nothing checked that the list
was complete. A reader that started reading a new table kept its old list, and
nothing failed. Each reader also stamped its own `readAt = nowUtc()`, and each
page built its own `Snapshot` literal around it.

## Decision

1. **A reader declares its tags and the tables it reads.** Each cache file
   exports `readers`, keyed by the `"use cache"` function, each a `ReaderDecl`
   `{ tags, tables }` (`lib/cache/reader.ts`). Tables are typed from
   `lib/database.types.ts`. The rule in the old manifest, "name every write",
   becomes "name every table".
2. **The writers of a table are stated once.** `TABLE_WRITERS`
   (`lib/cache/writers.ts`) lists the mutation kinds and external writers that
   write each table directly. FK cascades and columns no reader shows are left
   out on purpose. A reader depends on every writer of every table it
   declares; `missingBusts` lists the ones that bust none of its tags.
   `lib/invalidate.ts` is unchanged.
3. **Both sides are checked.** `lib/cache/readers.test.ts` fails when a cache
   file's functions and `readers` keys differ, when a writer misses, or when a
   service reads a table `TABLE_WRITERS` does not know.
   `lib/cache/readers.int.test.ts` runs each reader through a client that
   records every table it touches, embedded selects included, and fails when
   that set differs from `tables`.
4. **`stampRead` is the one stamp; a page only seeds.** A cached reader goes
   through `cachedRead(decl, read)`, which sets the tags and cacheLife and
   returns `stampRead(read)`: `{ readAt, data }`. Readers that seed nothing use
   `cachedValue`. A page takes the timezone and today from `readClock()` and
   builds its snapshot with `seedOf(read, clock, parts)`, so it cannot make up
   its own `readAt`. This extends ADR-0069.

## Consequences

- A new table read by an existing reader fails the integration test until it is
  declared, and then the unit test until its writers bust one of the tags.
- Adding a writer to a table is one line in `TABLE_WRITERS`, checked against
  every reader of that table.
- Tags are unchanged by this decision.
