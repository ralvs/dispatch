# Health and books are cut; the library page goes; domains live in Settings

Dispatch drops the health subsystem (metrics, medications, visits, labs,
wellbeing, workouts, documents, history) and the books shelf. That removes
their pages, services, schemas, the `log_health_metric` capture verb, the
Today-page health and reading cards, the reading cadence line, the chat
context's "Currently reading" section, and `quotes.book_id`. Migration
`0005_drop_health_books.sql` drops the tables. Journal stays untouched —
including `journal_books`, which is the physical-notebook index, not the
reading log.

The library page (`/library`) is gone too. It existed as the mobile front
door for features without tabs; with the shelf thinning out it no longer
earns a tab. The 5-tab shell becomes **Today / Notes / Projects / People /
Settings**. `/settings` is new: it hosts domain management (form + rows,
moved verbatim from the deleted `/domains` page), the web-push toggle
(previously stranded on the library page), and the app timezone readout.
Routines, quotes, journal, and chat remain desktop-rail links and are
reached contextually on mobile (Today's routine card, quote cards, and
capture chips).

Capture safety is unchanged: if the parser model still emits
`log_health_metric`, the verb fails `CaptureActionsSchema` and degrades to a
`needs_review` note — iron rule #4's never-lose path, same as any unknown
verb.

## Why

The owner doesn't use the health tracking or the reading log; they were
ported weight from the reference implementation. Every unused feature is
schema, RLS, tests, and nav surface to maintain (see docs/adr/0007 for the
same reasoning). Domains are configuration, not a daily destination — they
belong next to the other knobs, freeing a tab for Notes, which is now a
first-class surface (docs/adr/0012).
