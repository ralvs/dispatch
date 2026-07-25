# Dispatch

Personal operations dashboard. Capture in, order out.

A dispatch is a report filed from the field and the act of routing work where
it belongs — this app is both: frictionless text capture from anywhere (PWA
palette, Apple Watch webhook, iOS share sheet) parsed by an LLM into
structured records (tasks, notes, quotes, journal, people, events), surfaced
back as an editorial daily briefing.

Speech-to-text is done outside the app (OS dictation, third-party tools);
Dispatch routes the words. See `docs/adr/0017`.

Functional rebuild of [jerad-ops](https://github.com/ralvs/jerad-ops) —
see `docs/adr/` for every deliberate deviation.

## Stack

Next.js 16 · Supabase (Postgres/Auth/Storage) · Vercel AI SDK + AI Gateway ·
Tailwind v4 · Bun · Biome · Luxon · Vitest · iCloud CalDAV · Web Push

## Development

```bash
bun install
cp .env.example .env.local   # fill in (see comments)
bun dev                      # http://localhost:3000
bun run check                # biome + tsc + vitest
```

## Setup

_Grows per phase — sections for Supabase provisioning, iCloud app-specific
password, VAPID keys, and PWA install land with their features._

### The capture Shortcut (iOS share sheet + Apple Watch)

`POST /api/capture` is the only external surface (docs/adr/0022). Send it
text; it decides what the text is:

- a bare `https://…` URL → the reading list at `/links`, with the page's title
  and description fetched for you
- anything else → the capture parser → task, event, note, quote, or journal
  entry (docs/adr/0008, docs/adr/0023)

**1. Set the secret.** Generate one and put it in `.env.local` and in the
Vercel project (Settings → Environment Variables):

```bash
openssl rand -base64 32
```

**2. Verify it works before building anything.** Replace the host and secret:

```bash
curl -sS -X POST https://your-app.vercel.app/api/capture -H "Authorization: Bearer $CAPTURE_WEBHOOK_SECRET" -H 'Content-Type: application/json' -d '{"text":"almoço com a Ana quinta ao meio-dia"}'
```

A `201` with `{"kind":"capture",…}` means the text path ran; post a bare URL
instead and you should get `{"kind":"link",…}` and a new row at `/links`.

**3. Build the Shortcut.** In the Shortcuts app, create a new shortcut named
_Dispatch_:

| Step | Action | Settings |
| --- | --- | --- |
| 1 | — | Enable **Show in Share Sheet**; accept _Text_ and _URLs_ |
| 2 | Text | `Shortcut Input` |
| 3 | Get Contents of URL | See below |

Configure step 3:

- **URL** — `https://your-app.vercel.app/api/capture`
- **Method** — `POST`
- **Headers** — `Authorization: Bearer <your secret>`, `Content-Type: application/json`
- **Request Body** — JSON, one field: `text` (Text) = the output of step 2

Share anything to _Dispatch_ and it lands. On the Watch, run the same shortcut
and dictate — pass `"via": "voice"` in the body if you want the ledger to say
so. Transcription happens on the device, never in the app (docs/adr/0017).

### cron-job.org schedules

Both hit `Authorization: Bearer $CRON_SECRET`; cron-job.org defaults to `GET`
and both routes also accept `POST`.

| Endpoint | Frequency | Purpose |
| --- | --- | --- |
| `/api/cron/sweep` | as configured | Reconciles stuck `captured_data` rows to `needs_review` notes (docs/adr/0008). |
| `/api/cron/reminders` | every 5 minutes | Fires due-task reminders per the global offset/anchor in Settings (docs/adr/0021). |
