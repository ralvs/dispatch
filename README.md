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

### The capture Shortcuts (iOS share sheet, Siri, Apple Watch)

`POST /api/capture` is the only external surface (docs/adr/0022). Send it
text; it decides what the text is:

- a bare `https://…` URL → the reading list at `/links`, with the page's title
  and description fetched for you
- anything else → the capture parser → task, event, note, quote, or journal
  entry (docs/adr/0008, docs/adr/0023)

Every reply carries a `summary` field — one English sentence naming what the
text became ("1 event added.", "1 task added. 1 note saved.") — so a Shortcut
can speak the outcome back without opening the app.

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

**3. Build the share-sheet Shortcut.** In the Shortcuts app, create a new
shortcut named _Dispatch_:

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

Share anything to _Dispatch_ and it lands.

**4. Build the Siri Shortcut** (dictate from iPhone or Watch). A second
shortcut, named _Add to Dispatch_ — the name **is** the Siri phrase, so pick
one you can say cleanly and keep it distinct from the share-sheet shortcut:

| Step | Action | Settings |
| --- | --- | --- |
| 1 | Dictate Text | Language: your speaking language · Stop Listening: **After Pause** |
| 2 | Get Contents of URL | Same URL, method, and headers as above |
| 3 | Get Dictionary Value | Get **Value** for key `summary` in `Contents of URL` |
| 4 | Show Result | `Dictionary Value` |

The request body in step 2 is JSON with three Text fields:

| Key | Value |
| --- | --- |
| `text` | `Dictated Text` (the variable from step 1) |
| `via` | `voice` |
| `source` | `watch` |

Then, in the shortcut's details pane: turn **Show on Apple Watch** on, and
turn **Show When Run** off on the _Get Contents of URL_ action so a Siri run
never stops to show you a sheet.

Say _"Hey Siri, Add to Dispatch"_, dictate a sentence, and Siri reads back what
it became. The whole utterance goes to the parser: _"lembrar de ligar pro
dentista amanhã de manhã"_ becomes a task with a due date, _"almoço com a Ana
quinta ao meio-dia"_ becomes a calendar event, anything unclassifiable becomes
a note you can sort from `/inbox`. Nothing is ever dropped (iron rule #4).

Notes on this flow:

- **Transcription is the device's job, never the app's** (docs/adr/0017). The
  Shortcut sends words, not audio; `via: "voice"` is provenance only.
- **`source: "watch"`** just labels the ledger row. Use `webhook` instead if
  you would rather not distinguish them — those are the only two values the
  endpoint accepts.
- **Bilingual** — dictate in PT-BR or EN and the content is stored verbatim in
  the language you spoke (iron rule #5). _Dictate Text_ takes one language per
  shortcut, so duplicate it if you want a dedicated phrase per language.
- **Faster triggers** — assign the shortcut to the Action Button, Back Tap, or
  a Watch complication for a press-and-talk capture with no Siri phrase at all.
- The bare-URL branch effectively never fires here; dictated speech is not a
  lone URL, and a sentence that merely mentions a link is a capture, not a
  bookmark.

### cron-job.org schedules

Both hit `Authorization: Bearer $CRON_SECRET`; cron-job.org defaults to `GET`
and both routes also accept `POST`.

| Endpoint | Frequency | Purpose |
| --- | --- | --- |
| `/api/cron/sweep` | as configured | Reconciles stuck `captured_data` rows to `needs_review` notes (docs/adr/0008). |
| `/api/cron/reminders` | every 5 minutes | Fires due-task reminders per the global offset/anchor in Settings (docs/adr/0021). |
