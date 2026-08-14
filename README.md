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

**3. Build the Shortcut.** One shortcut covers both ways in: shared text posts
straight through, and launching it with nothing to share falls into dictation.

| Step | Action | Settings |
| --- | --- | --- |
| 1 | — | **Show in Share Sheet**, accept _Text_, _Rich Text_, _URLs_ · **If there's no input: Continue** |
| 2 | Text | your secret, pasted |
| 3 | Set Variable | `token` = the output of step 2 |
| 4 | If | `Shortcut Input` **has any value** |
| 5 |  → Set Variable | `payload` = `Shortcut Input` |
| 6 | Otherwise | |
| 7 |  → Dictate Text | Stop Listening: **After Pause** |
| 8 |  → Set Variable | `payload` = `Dictated Text` |
| 9 | End If | |
| 10 | If | `payload` **has any value** |
| 11 |  → Get Contents of URL | See below |
| 12 |  → Get Dictionary Value | **Value** for key `summary` in `Contents of URL` |
| 13 |  → Show Result | `Dictionary Value` |
| 14 | End If | |

Configure step 11:

- **URL** — `https://your-app.vercel.app/api/capture`
- **Method** — `POST`
- **Headers** — `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body** — JSON, one field: `text` (Text) = `payload`

The token lives in step 2 and nowhere else, so rotating the secret is one
paste in one place.

**Step 1's "If there's no input" must be `Continue`, not `Get Clipboard`.**
The clipboard fallback is right for a share sheet and actively wrong for every
other trigger: launched from Siri or a button there is no shared input, so the
fallback fires and posts whatever you last copied — a stray word captured with
no idea where it came from. `Continue` leaves the input genuinely empty, which
is what step 4 needs to branch into dictation.

Step 10 catches the other empty case: silence, or a dictation you cancelled.
Without it the request goes out with an empty `text` and comes back 400, which
surfaces as a shortcut error rather than a quiet no-op.

**Siri cannot hand you a one-liner.** "Hey Siri, Add to Dispatch buy milk"
matches the name and drops "buy milk" — trailing words are not passed into a
user-authored shortcut, so the Siri path is always two beats (invoke, then
speak). For genuinely one-step capture, skip Siri: bind the shortcut to the
**Action Button**, **Back Tap**, or a **Watch complication** and dictation
starts the moment it launches. Press, speak, done.

Then, in the shortcut's details pane, turn **Show on Apple Watch** on.

The whole utterance goes to the parser: _"lembrar de ligar pro dentista amanhã
de manhã"_ becomes a task with a due date, _"almoço com a Ana quinta ao
meio-dia"_ becomes a calendar event, anything unclassifiable becomes a note you
can sort from `/inbox`. Nothing is ever dropped (iron rule #4).

#### Dictating a task straight into its domain

The parser never infers routing — it sets `domain`/`project` **only** when you
name one, and copies the name from the lists in its prompt (docs/adr/0019 D1).
So "marcar dentista amanhã" is always unfiled; say the destination and it isn't.

- **No punctuation needed** — you can't dictate a colon anyway. Just lead with
  the word: "saúde marcar dentista pra semana que vem" files under Health with
  the title "marcar dentista". A connector ("tarefa de saúde…", "na saúde…",
  "no Dispatch…") or a trailing mention ("…isso é casa") works the same.
- **Say it in Portuguese if that's what you're speaking.** `saúde` → Health,
  `casa` → Home, `família` → Family, `finanças` → Finance, `viagem` → Travel,
  `código` → Code. The model bridges to the listed English name, so you never
  have to drop an English word into a Portuguese sentence for dictation to
  mangle. The *resolver* is exact-match, but it only ever sees what the model
  copied off the list.
- **Naming a project gets the domain for free.** A resolved project inherits
  its domain, so "no Dispatch, arrumar o parser" files under Code without
  saying Code. Project names are proper nouns, which dictation handles better
  than common words.
- **A word that isn't on either list routes nothing** — "trabalho: revisar os
  PRs" lands unfiled, because there is no Work domain. Check `/domains` for the
  current list; add the domain rather than fighting the phrasing.
- **Events take no domain at all.** `create_event` has no routing field; a
  captured event's domain comes from which calendar it lands on. Naming a
  domain while dictating an event is harmless but does nothing.
- **If a task lands in a project you didn't name**, that is the parser
  volunteering one rather than omitting the field. The prompt argues against it
  and it is now rare, but it is not structurally prevented — the resolver
  cannot tell a copied name from an invented one.

Notes on this flow:

- **Transcription is the device's job, never the app's** (docs/adr/0017). The
  Shortcut sends words, not audio.
- **Provenance is per-shortcut, not per-capture.** The body's optional `via`
  (`voice`/`text`) and `source` (`webhook`/`watch`) fields only label the
  ledger row, and one shortcut serving both entry points can only send one
  value. Leave them at their defaults unless the label earns a second shortcut.
- **Bilingual** — dictate in PT-BR or EN and the content is stored verbatim in
  the language you spoke (iron rule #5). _Dictate Text_ takes one language per
  shortcut, so duplicate it if you want a dedicated phrase per language.
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
