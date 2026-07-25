# One external capture surface, and "ingest" is retired

Date: 2026-07-25

## Context

Phase 7 shipped `POST /api/ingest` (free text → the capture pipeline) and
ADR-0014 added `POST /api/links` (a URL → the reading list), deliberately
separate because "a bare URL has nothing to parse".

Both were correct and neither was ever used. A repo-wide search found zero
callers: no iOS Shortcut, no watch client, no setup docs. The README still
carries a placeholder promising that "the Ingest shortcut" would land with its
feature. It never did. Two authenticated endpoints sat unreachable for two
months, which is also why the reading list at `/ingest` looked permanently
empty.

The word had meanwhile spread across five unrelated things — the text webhook,
the link webhook, the reading list page, the `ingest_links` table, and (by
association) task triage and the system Inbox domain. `lib/schemas/ingest-link.ts`
opened with a comment apologising for the collision.

Nothing depended on either contract, so both were free to reshape.

## Decision 1 — one endpoint, routed by content

`POST /api/capture` replaces both. The body is text; the endpoint decides:

- the whole message is a bare `http(s)` URL → the reading list, with title and
  description resolved from the page
- anything else → `capture()`, unchanged (docs/adr/0008)

The split was by payload shape, which meant the *sender* had to classify
before sending — picking an endpoint is the same judgement call this app
exists to absorb. One endpoint, one secret, one Shortcut.

"Bare" is strict: a sentence that merely contains a link ("read this before
Friday: https://…") is a capture, not a bookmark, and the parser keeps the URL
in the task or note body. `bareUrl()` is exported and unit-tested because it is
the whole routing decision.

`INGEST_WEBHOOK_SECRET` becomes `CAPTURE_WEBHOOK_SECRET`; ledger types
`ingest.captured`/`ingest.link` become `capture.text`/`capture.link`
(`notifications.type` has no check constraint, so no migration).

## Decision 2 — links arrive with a title

`createLink` stored "whatever the sender knew", and a share sheet knows only
the URL. `lib/links/metadata.ts` fetches the page and reads `og:title` /
`<title>` and `og:description` / `meta[name=description]`.

It is best-effort by contract, the same shape as the AI parser: http(s) only,
5s timeout, 512KB cap, HTML content-types only, streaming stops at `</head>`,
and every failure path returns nulls. An unreachable host still saves the link
— the enrichment is a nicety, the row is the guarantee (iron rule #4).

Regex, not a DOM parse: this runs against a document we do not control and
needs exactly two fields from the head.

## Decision 3 — the page is `/links`, the table stays `ingest_links`

The reading list moves to `/links`; the schema and service drop the prefix
(`LinkRow`, `CreateLinkSchema`, `lib/services/links.ts`).

The **table keeps its name**. Renaming it is a migration over live rows —
including a backfill of note tags — for zero functional gain. `ingest_links`
is now the only surviving use of the word, isolated behind a `TABLE` constant
with a comment saying so.

## Consequences

- `/api/ingest` and `/api/links` are gone. Nothing called them, so nothing
  breaks, but the secret **must** be renamed in Vercel before the next deploy
  or the endpoint 401s.
- Task triage (`/triage`) and the system Inbox domain keep their names; they
  were only confusing next to "ingest", which no longer exists.
