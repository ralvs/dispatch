# One calendar mirror, two source adapters

Date: 2026-10-13

Two feeds fill `calendar_events`: iCloud over CalDAV (docs/adr/0006) and the
work calendar through the Mac EventKit bridge (docs/adr/0018). Each had its
own copy of the same reconcile — known rows by uid, skip the unchanged,
write the changed, a windowed set-difference delete, a sync-state row — and
the copies had drifted. The bridge deduped uids and wrote one batched
upsert; CalDAV wrote one request per event. The bridge compared
`calendar_name`; CalDAV did not. Failure handling lived in three more
places: the cron route wrote `{ error }` to `caldav_sync_state` and told
no one, the bridge route wrote a ledger row on every failed POST and never
touched `google_sync_state`, and "Sync now" recorded nothing at all.

Amends ADR-0075 item 5: a calendar sync's failure is announced by the
mirror, not by a route. Closes the open line in ADR-0080's Consequences:
iCloud failures now raise and resolve alerts as the bridge's do.

## Decision

1. **`lib/services/calendar-mirror.ts` owns the reconcile for one feed and
   window**, and writes the feed's sync-state row on success and on failure.
   Nothing else writes either row.
2. **CalDAV and the EventKit bridge are adapters.** Each hands the mirror a
   `MirrorSnapshot` naming its window, the calendars it speaks for, and
   `trustEmpty` — whether an empty snapshot clears the window (the bridge)
   or compares nothing (CalDAV). A CalDAV read where every calendar failed
   is an error, never an empty snapshot.
3. **The mirror announces a failed sync.** Working → failed records
   `<feed>.sync_failed` (`caldav.sync_failed`, `gcal.sync_failed`) through
   `recordNotification`; an already-failing feed records only its state.
4. **A successful sync resolves that type's unread alerts** (ADR-0080). The
   per-run record is the sync-state row; the ledger records the outage.
5. **Routes and the "Sync now" action only turn the mirror's `MirrorResult`
   into a response.** The mirror never throws.

## Consequences

- iCloud failures now raise one alert per outage; they were silent.
- Bridge failures raise one alert per outage; they were one per POST.
- Bridge failures write `{ error }` to `google_sync_state`, so Today shows
  the failure at once instead of waiting for the feed to go stale.
- A failed "Sync now" records its state like a failed cron run.
- `calendar_name` joins the unchanged check for iCloud: an event moved to
  another calendar is rewritten.
- The same uid on two iCloud calendars ends as the last copy in the
  snapshot, as it already did for the bridge.
- CalDAV opens its connection inside the read, so a login failure is
  recorded like any other failed sync.
- No migration.
