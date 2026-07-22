# Google Calendar pull-only alongside iCloud CalDAV

Dispatch pulls events from **both** iCloud CalDAV (personal) and Google
Calendar (Engine work). Google is **read-only**: never create, update, or
delete remote Google events. OAuth uses **`calendar.readonly` only** — no
Gmail, Drive, or other Google APIs (employer policy: calendar permitted,
email forbidden).

## Why

ADR-0006 chose iCloud CalDAV because the owner lives on Apple Calendar.
Work events live on Google Workspace and never appear in that pull. Today’s
day schedule must show both. Pull-only matches actual need (no push to work
calendar) and minimizes API surface.

## Auth

Single-user offline OAuth: a one-shot script (`scripts/google-calendar-auth.ts`)
obtains a refresh token with `calendar.readonly` + `access_type=offline`.
Runtime secrets are env vars only (`GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`) — same posture as iCloud
credentials; no token table, no in-app consent UI.

## Sync shape

- Cron: `/api/cron/gcal` behind `CRON_SECRET` (parallel to `/api/cron/caldav`)
- Window: ±7 days (same as CalDAV)
- Calendars: all calendars visible to the token
- Recurrence: `singleEvents=true` — one row per expanded instance (better for
  Today than CalDAV’s one-row-per-series limit; intentional difference)
- Identity: `source='google'` + `caldav_uid` = Google event id; unique on
  `(source, caldav_uid)` so providers cannot overwrite each other
- Cancellations: windowed set-difference on `source='google'` (cancelled
  events are not upserted and thus leave the table)
- State: `google_sync_state` singleton; ledger `gcal.synced` only when
  pulled+removed > 0

## Non-goals

- Push or edit on Google
- Any non-calendar Google scope
- Cross-provider dedup of dual invites (two rows OK for v1)
- In-app OAuth UI or multi-account Google
