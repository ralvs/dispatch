# Google Calendar pull-only via browser OAuth

Dispatch pulls events from **both** iCloud CalDAV (personal) and Google
Calendar (Engine work). Google is **read-only**: never create, update, or
delete remote Google events. Access is **browser OAuth** with scope
**`calendar.readonly` only** — no Gmail, Drive, or other Google APIs.

## Why

ADR-0006 chose iCloud CalDAV for Apple-primary personal calendars. Work
events live on Google Workspace (`renan.alves@engine.com`). Secret ICS
URLs and public ICS feeds are unreliable on this Workspace (public 404,
secret address often unavailable). Browser OAuth is the same class of
flow Apple Calendar uses: user signs in, grants calendar read, app stores
a refresh token.

The owner has **no employer GCP**. A **personal** Google Cloud project
hosts the OAuth client (client id/secret in env). At connect time the
owner signs in as the **Engine** account and consents only to calendar
read. Employer policy: calendar permitted; email forbidden — we never
request mail scopes.

## Auth / config

| Piece | Where |
|-------|--------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Env (personal GCP Web client) |
| Redirect URIs | `{origin}/api/google/oauth/callback` (localhost + prod) |
| Refresh token | `google_sync_state.refresh_token` (service-role only) |
| Connect / disconnect | Settings → Integrations |

Flow:

1. Owner opens Settings → **Connect Google Calendar**
2. `/api/google/oauth/start` (requireOwner) → Google consent (`calendar.readonly`, offline)
3. Callback exchanges code, stores refresh token + primary calendar id label
4. Cron `/api/cron/gcal` refreshes access token and pulls ±7 days from all calendars

## Sync shape

- Calendar API v3: `calendarList` + `events.list` (`singleEvents=true`)
- Identity: `source='google'` + Google event id; unique `(source, caldav_uid)`
- Cancellations: windowed set-difference on `source='google'`
- Ledger: `gcal.synced` only when pulled+removed > 0

## Non-goals

- Push or edit on Google
- Any non-calendar Google scope
- ICS secret-URL path (superseded)
- Cross-provider dedup of dual invites
