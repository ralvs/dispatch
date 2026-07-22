# Google Calendar pull-only via secret ICS feeds

Dispatch pulls events from **both** iCloud CalDAV (personal) and Google
Calendar (Engine work). Google is **read-only**: never create, update, or
delete remote Google events. Access is via each calendar’s **secret iCal
address** (HTTPS GET of a private `.ics` URL) — **no Google Cloud project,
no OAuth app, no Calendar API**.

## Why

ADR-0006 chose iCloud CalDAV because the owner lives on Apple Calendar.
Work events live on Google Workspace (`renan.alves@engine.com`) and never
appear in that pull. The owner has no GCP access on the employer domain;
Apple Calendar already uses a Google login for the same account. Secret ICS
URLs are the supported “subscribe without OAuth client” path Google exposes
in calendar settings (same family of feed Outlook/others use).

Calendar-only HTTP GET of an ICS body matches employer policy: calendar is
permitted; email is not. No Gmail scope exists to request.

## Auth / config

Env only — one feed list, no tokens:

```
GOOGLE_CALENDAR_ICS_FEEDS=Work|https://calendar.google.com/calendar/ical/…/private-…/basic.ics
```

Multiple feeds: semicolon-separated `Name|url` pairs. Names become
`calendar_events.calendar_name`. Obtain each URL from Google Calendar →
Settings for that calendar → Integrate calendar → **Secret address in iCal
format**. Treat the URL as a secret (full read of that calendar).

## Sync shape

- Cron: `/api/cron/gcal` behind `CRON_SECRET` (parallel to `/api/cron/caldav`)
- Fetch each ICS URL; parse with the shared CalDAV ICS parser (`lib/caldav/ical.ts`)
- Window: ±7 days (first intersecting occurrence per RRULE series — same as CalDAV)
- Identity: `source='google'` + `caldav_uid` = iCal UID; unique on
  `(source, caldav_uid)` so providers cannot overwrite each other
- Change skip: HTTP `ETag` (or body hash) + resolved `start_at`
- Cancellations: windowed set-difference on `source='google'`
- State: `google_sync_state` singleton; ledger `gcal.synced` only when
  pulled+removed > 0

## Non-goals

- Push or edit on Google
- Google Calendar API / OAuth / GCP
- Any non-calendar Google surface
- Cross-provider dedup of dual invites (two rows OK for v1)
- Auto-discovery of every calendar on the account (owner pastes the feeds they want)
