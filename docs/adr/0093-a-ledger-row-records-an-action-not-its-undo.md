# A ledger row records an action, not its undo

Date: 2026-10-14

The `notifications` table came from the reference implementation with an
`undo_payload` column. Seven MCP writes (ADR-0079) filled it: event create,
update and delete, link read, note update, and task update and skip. It held
the id of a created event, the previous fields of an edit, the whole row of a
deleted event. Nothing read it. No screen, route or job replayed an undo.

What it cost:

- **It grew without a bound.** Each `update_note` append stored the whole old
  body. Ten appends to a 50 KB note kept ten copies, about 500 KB, and nothing
  ever cleared them.
- **A safe replay is a feature of its own.** It must not overwrite an edit made
  after the assistant's. An event needs the iCloud etag. A deleted event comes
  back with a new UID. A blob written "for later" answers none of this.
- **Every tool built its own shape.** Seven writes, seven field lists, one
  reader that did not exist: a seam with no adapter on the far side.

## Decision

1. **A ledger row records what happened, not how to reverse it.** No caller
   passes undo data. `recordNotification` has no `undo_payload` field and the
   column is dropped: first the code stops writing and reading it, then a
   later migration drops it (a migration must work with the live code).
2. **An assistant's change is undone by hand.** The ledger row says what
   changed; the owner fixes it in the app, or asks the assistant, which read
   the old values before it wrote. A tick has its own undo in the app
   (un-tick, `reopenTask`).
3. **A real undo brings its own storage.** If undo becomes a feature, it
   starts from its reader: what the screen offers, how it detects a later
   edit, how long it keeps the data. Not from a free-form JSON blob on every
   row.

## Consequences

- This departs from the reference implementation's schema.
- Dispatch keeps no copy of a note body the assistant overwrote, or of an
  event it deleted. `update_note`'s `append` stays the safe edit; `body`
  overwrites.
- PRODUCT.md principle 4 still holds in its first half: the owner sees what
  the system did. "Where possible, undo it" is by hand for now.
- The architecture review's AC-17 ("an assistant write records itself in one
  step", issue #89) is rejected: its only reason to exist was the undo shape.
