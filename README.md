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

_Grows per phase — sections for Supabase provisioning, cron-job.org schedules,
iCloud app-specific password, VAPID keys, the Ingest shortcut, and PWA install
land with their features._
