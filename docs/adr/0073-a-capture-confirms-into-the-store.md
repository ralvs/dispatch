# A capture confirms into the store

Date: 2026-10-02

ADR-0069 §5 left one common write on `updateTag`: a palette capture. The parser
decides which rows a capture writes, so the client has nothing to apply before
the answer, and the executor returned only `{ table, id }`. Every capture cost a
page render and a wipe of the client router cache.

## Supersedes

- ADR-0069 §5 for palette captures that book no calendar event. The old ADR is
  left as written.

## Decision

1. **The capture module returns the rows it wrote.** An executed action's
   `entity` carries its `row` (task, note, quote, journal entry); a degraded
   action and a degraded capture carry their `needs_review` note. Note creates
   select the list shape, so a note comes back as the store holds it.
   `capturedRows(record)` sorts them by store kind.
2. **The palette confirms them** (`lib/store/receive.ts`). Each row goes in as a
   create the server already confirmed, stamped with the action's `readAt`
   (before the capture) and `at` (after it). So every view that would list the
   row does, every count it moves moves (Today's open and inbox counts, the
   review count), and a seed read before `at` replays it like any confirmed
   write. A store that no page seeded gets its clock from the answer.
3. **`capture.settled` busts tags only.** A capture that booked a calendar event
   uses `capture.event` instead, which reads its own write with `updateTag`:
   the store holds no events.
4. **A confirm that fails renders the page.** The capture has already landed;
   offering a retry would capture it twice.

## Consequences

- A palette capture no longer re-renders the page it was made on, unless it
  booked an event.
- The capture webhook (`/api/capture`) and the sweep are unchanged: they run
  outside a browser, and an open tab learns of their writes through its
  five-minute pull.
- `capture.event` is named next to `capture.settled` in every cached reader's
  manifest (`lib/cache/`).
