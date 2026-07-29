# Calendar sync is iCloud CalDAV: pull all calendars, push to one

Google Calendar OAuth is replaced by CalDAV against `caldav.icloud.com`
(tsdav, Basic auth with an app-specific password — no OAuth flow, no token
table). Sync pulls VEVENTs ±21 days from ALL calendars on the account (each
event stores its `calendar_name`); app-created events are pushed only to the
calendar named by `ICLOUD_CALENDAR_NAME` (a dedicated "Dispatch" calendar).
Cancellation detection is windowed set-difference on `caldav_uid` — CalDAV
has no tombstones.

## Why

The owner lives on Apple Calendar and Apple exposes no REST API; CalDAV is
the supported protocol. Pull-all because the Today briefing must show the real
day, including shared calendars. Push-to-one keeps app-created events visually
distinct in Apple's UI and makes the write path trivially reversible (delete
one calendar).
