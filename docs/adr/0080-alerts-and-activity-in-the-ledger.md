# Alerts and activity in the ledger

Date: 2026-10-06

Every ledger row landed `unread`. By 4 October 2026 the list held 67 unread
rows: 27 fired reminders, 38 captures, and two calendar failures from three
weeks before. Today's counter said "67 notifications", and the two rows that
needed the owner were buried (#99). Each reminder and capture had already
reached the owner as a push.

## Amends

- ADR-0075: what a recorded row's status is. The ledger still owns the row,
  its push and its tags.

Iron rule #6 is unchanged: every autonomous action still writes its row.

## Decision

1. **A row is an alert or activity, read from its `type`**
   (`lib/notification-kind.ts`). An alert is a type ending in `failed`, or
   `cron.sweep` (stuck captures). Everything else is activity. An unknown type
   is activity, so a new writer opts in to interrupting.
2. **Activity lands `read`; an alert lands `unread`.** `insertNotification`
   sets the status. Push is unchanged: every committed row still pushes, so a
   fired reminder still reaches the phone.
3. **Unread means "something failed".** Today's counter counts unread rows, so
   it now shows only when an alert is waiting.
4. **/notifications keeps every row.** Unread rows sort to the top, then the
   rest, newest first. Activity stays on the record, read.
5. **The backlog follows the same rule once.** Migration
   `20261006143823_ledger_activity_read.sql` marks unread activity read. Its
   `where` clause mirrors `notificationKind`.

## Consequences

- Nothing dismisses a row on its own. An automatic clear would be an
  autonomous action, and iron rule #6 would ask for a row about it.
- A type that should interrupt must end in `failed` or join `ALERT_TYPES`.
  Change the migration's rule only with a new migration.
