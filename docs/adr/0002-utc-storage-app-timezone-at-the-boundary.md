# Storage is UTC; the app timezone exists only at the boundary

Every persisted timestamp is UTC (`timestamptz`, `.toUTC().toISO()`). The app
timezone (from `app_settings.timezone`, seeded `America/Sao_Paulo`) is applied
only in `lib/dates.ts`: display formatting, input interpretation, parser
natural-language date resolution, and day-boundary math (`todayInAppTz()`,
`dayWindowUtc()`). Date-only columns (due dates, routine completion dates,
top-3 pins) are app-timezone calendar dates computed through the same helpers.

## Why

The reference mixed server-local `new Date()` math with Mountain-Time strings
and shipped at least one real bug from it (chat's "recent events" used
server-local midnight). One rule — UTC persists, Luxon converts at the edges —
makes every date computation testable and deploy-region-independent.
