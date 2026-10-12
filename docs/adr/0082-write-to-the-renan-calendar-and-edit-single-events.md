# Write to the Renan calendar, and edit single events there

Date: 2026-10-12

ADR-0006 sent every event Dispatch creates to a dedicated "Dispatch"
calendar. That kept them apart in Apple Calendar, and deleting one calendar
undid everything Dispatch wrote. The owner wants them on "Renan", the
calendar they live in, and wants Dispatch to edit and delete events too
(#115). An assistant on the MCP endpoint will do that next (#116).

Two problems came with it:

- The CalDAV sync pulls every calendar, the write calendar too. An event
  Dispatch created came back under the same UID as a second row,
  `source = 'caldav'`, beside its `created_here` row. Unique is
  `(source, caldav_uid)` (ADR-0018), so the two never collided, and Today
  listed the event two times. On "Dispatch" this was rare; on "Renan" it
  happens on every create.
- `createEventHere()` kept no href or etag, so a new event could not be
  edited until a sync, and the sync then wrote the twin instead.

## Supersedes

- ADR-0006, "push to one dedicated calendar". The write calendar is still
  the one named by `ICLOUD_CALENDAR_NAME`; its value is now `Renan`.
  Pull-all is unchanged.

## Decision

1. **`ICLOUD_CALENDAR_NAME=Renan`.** The old "Dispatch" calendar and its
   one row stay as they are.
2. **One row per event, matched on UID.** A sync that sees a UID held by a
   `created_here` row updates that row in place and keeps its source. It
   never matches on calendar name, which would stop working the day the
   write calendar changes again. `created_here` rows join the windowed
   set-difference, so an event deleted in Apple Calendar leaves Today too.
   Two guards keep that delete honest: only calendars that answered this
   sync are compared, and a row written after the sync began is skipped.
3. **Edit and delete go to iCloud first, then the row.** The service reads
   the iCloud copy and patches it (`patchEventObject`), so alarms,
   attendees and time zones Dispatch does not store survive. The write
   sends the etag the last sync saw as `If-Match`. A change made in Apple
   Calendar since then answers 412, and the service reports it as a
   `CONFLICT`: "changed in iCloud since the last sync". Nothing is
   overwritten.
4. **Only single events on the write calendar can be edited**
   (`lib/calendar-edit.ts`). Refused, with the reason: work events
   (`source = 'google'`, pull-only, ADR-0018), events on any other iCloud
   calendar (some are shared), and series. One row stands for a whole
   series (`lib/caldav/ical.ts`), so an edit through it would change every
   occurrence. A new `calendar_events.recurring` column records which rows
   are series; null means not synced yet. The column only shapes what the
   UI offers. Edit and delete read the live iCloud copy first and refuse a
   series from that, so a null row (outside the sync window, or not synced
   yet) is still safe to edit.
5. **A created event stores its href and etag**, so it can be edited at
   once.

## Consequences

- Deleting one calendar no longer undoes what Dispatch wrote. Dispatch's
  events sit among the owner's own; the ledger (iron rule #6) is the record
  of what it did.
- An all-day event can be renamed but not moved. Dispatch creates only
  timed events, and moving an all-day one needs date semantics the patch
  does not have.
- Deleting an event deletes its note links with the row (`on delete
  cascade`).
- The first sync after the migration rewrites every iCloud row inside its
  window once, to learn `recurring`. Rows outside the window stay null.
- An edit that finds the event gone from iCloud removes its row, since a
  sync drops only rows inside its window.
