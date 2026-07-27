# An unfiled task has no domain

Date: 2026-07-27

Supersedes ADR-0024 ("The unfiled-task queue is the Inbox") Decision 2, and
closes the item that ADR deferred.

## Context

ADR-0024 kept the Inbox as a seeded `stewardship_domains` row and made
`is_system` the categorical test for "is this a real stewardship domain". It
named the cost in its own last bullet:

> The Inbox is still typed as a stewardship domain while carrying none of the
> semantics — no `fruit_definition`, no `expected_cadence`, no
> `failure_patterns` — so consumers still special-case it out. Making
> `tasks.domain_id` nullable and deleting the row would remove that wart, at
> the cost of a schema migration. Considered and deferred.

The wart was six filters. Every list of domains that fed a picker
(`task-fields`, `project-form`, `project-detail`), the routing lists handed to
the capture parser, the slippage loop in `deriveBriefLines`, and a guard in
`domains.ts` that refused to rename or archive the row — each existed only to
undo the decision to store "no domain" as a domain. `NOT NULL` was what forced
that decision, and nothing else depended on it.

## Decision — NULL is the representation

`tasks.domain_id` is nullable. The Inbox row is deleted, `is_system` is
dropped, and the `/inbox` queue is `status = 'open' and domain_id is null`.

The six filters are gone rather than rewritten: with no pseudo-domain in the
table, every row a picker lists is a real destination, and every row the
settings page shows is fully editable and archivable.

`INBOX_DOMAIN_ID` is gone too. It was the last hardcoded row UUID in
`lib/constants.ts`, which is now just the calendar sync window.

## Decision — filing stays one-way, structurally

ADR-0024 §3 stands: a task leaves the inbox and never returns. What changes is
the enforcement. That ADR needed a runtime `throw` in `assignDomain`, because
the Inbox was a valid UUID that any caller could pass. Un-filing now means
writing NULL, and no write path can:

- `assignDomain(sb, id, domainId: string)` takes a domain, not an absence.
- `updateTask`'s patch types `domain_id` as `string`, and the task action maps
  an empty domain field to `undefined` — "leave it alone", never "clear it".

So the guard was deleted rather than reworded. The type is the enforcement.

The task edit form offers an **Unfiled** option only when unfiled is already
the answer — the create form (`undefined`) or a task sitting in the inbox
(`null`). A filed task never sees the option. This is the same reasoning as
ADR-0024's "current value stays listed" exception, and it is still load-bearing
for the same reason: without it the `<select>` would drop its own value and
silently reassign an inbox task to whichever domain sorts first.

One behaviour change falls out. The full create form used to default its domain
to whichever row sorted first; it now defaults to **Unfiled**, which is what
quick-add and the capture pipeline have always done. Stating a domain at
capture time is a choice, not a side effect of the form's ordering.

## Consequences

- No external contract moved. `briefing.inboxCount` and the widget API's
  `inbox_count` keep their names; the number now counts tasks with no domain,
  which is the thing it always displayed. `/triage` still redirects to
  `/inbox`.
- `lastCompletedByDomain` excludes unfiled completions explicitly — there is no
  domain to attribute them to, and letting them through would key the cadence
  map on null.
- The FK stays `NO ACTION` on purpose. `on delete set null` would quietly
  un-file a domain's tasks and contradict one-way filing; domains are archived,
  not deleted, and there is no `deleteDomain` service.
- The base schema migration still seeds the Inbox row and this migration
  deletes it again. Migrations are append-only, so a fresh rebuild runs both in
  order and lands in the same place.
- A second system-ish row, if one is ever wanted, no longer has a flag to hang
  itself on. That is the trade: ADR-0024 kept `is_system` because it "survives
  a second system row", and no second row ever arrived.
