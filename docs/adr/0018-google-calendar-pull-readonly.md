# Work Google calendars via Mac EventKit bridge

Dispatch pulls personal calendars from **iCloud CalDAV** (ADR-0006) and work
(Engine Google) calendars via a **local Mac bridge**: EventKit reads calendars
already synced into Apple Calendar and POSTs them to a secret-authed endpoint.

## Why not Google OAuth / Calendar API

Browser OAuth with a personal GCP client was attempted. The Engine Workspace
admin blocks unapproved third-party apps at consent (`access_denied` /
admin policy). Secret ICS URLs and public ICS feeds are unavailable or 404.

Apple Calendar on the owner’s Mac **is** allowed to sync the work Google
account. EventKit therefore sees Engine events without a second Google login.

## Architecture

```
macOS Calendar (Engine Google, already synced)
        │ EventKit
        ▼
scripts/mac-calendar-bridge (Swift, launchd every 15m)
        │ POST /api/calendar/bridge
        │ Authorization: Bearer CALENDAR_BRIDGE_SECRET
        ▼
syncBridgeEvents → calendar_events source='google'
```

- Pull-only into Dispatch; no writes back to Google or Apple Calendar
- Window: ±7 days (bridge-controlled; body carries `window_start` / `window_end`)
- Identity: unique `(source, caldav_uid)` with `source='google'`
- Cancellations: windowed set-difference on `source='google'`
- Allowlist of calendar **titles** on the Mac so iCloud calendars are not double-imported
- Ledger: silent on success (bridge runs every 15m); `gcal.sync_failed` + push only on error

## Config

| Piece | Where |
|-------|--------|
| `CALENDAR_BRIDGE_SECRET` | Vercel + Mac bridge env (min 20 chars) |
| `DISPATCH_BASE_URL` | Mac bridge (e.g. `https://dispatch…`) |
| `DISPATCH_BRIDGE_CALENDAR_TITLES` | Mac bridge; comma-separated Apple Calendar titles |

## Non-goals

- Google OAuth / GCP / Calendar API
- Pushing events to Google
- Running the bridge on any machine other than the owner’s Mac
- Auto-discovering every calendar (explicit title allowlist required)
