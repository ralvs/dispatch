# The Find palette is a locate verb, not a page

Date: 2026-09-07

Find is a command palette (⌘K) over tasks and notes. It is not a route, not a
third header pill, and not Chat.

## Why

Capture (⌘J) puts a thought in. Ask (`/chat`) answers a question from a
snapshot. Nothing located a row by a remembered word. The link picker already
searches task titles; Find is that idea grown up: task `title` **and** `notes`,
note `title` **and** `body`, ranked, with a snippet so a body hit is honest.

DESIGN.md spent the two standing header actions on Capture and Ask. Find is a
key and a More-menu row.

## Decision

- ⌘K / Ctrl+K opens the palette. Capture keeps ⌘J.
- v1 corpus is tasks and notes. Quiet and done tasks still appear.
- Title hits outrank body/notes hits. Empty query shows recents.
- `searchTasksByTitle` stays title-only for the link picker.

## Consequences

Find is a read behind `requireOwner()`. No ledger row. No `/api/find`.
