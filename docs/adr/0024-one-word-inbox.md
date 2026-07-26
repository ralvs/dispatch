# The unfiled-task queue is the Inbox, and "triage" is retired

Date: 2026-07-26

Supersedes ADR-0014 §2 ("Naming: Ingest vs Triage vs system Inbox domain").

## Context

ADR-0014 assigned three names to three concepts and warned "do not collapse
labels": **Ingest** for the link reading list, **Triage** for unassigned tasks,
**Inbox** for the system stewardship domain holding them. The split existed for
one reason, recorded in that ADR's own postscript — an earlier draft wanted to
call the *link list* "Inbox", and the owner chose otherwise. "Triage" was the
word that got out of the way.

ADR-0022 moved the link list to `/links` and deleted "ingest" from the
codebase. The premise expired with it: nothing else claims "inbox".

The split had never actually held in the implementation. Three idioms answered
"is this the Inbox domain":

- `d.is_system` — 6 sites
- `INBOX_DOMAIN_ID` — 5 sites
- `t.domain?.name === "Inbox"` — one literal string, in `app/(authed)/tasks/page.tsx`

and one number carried three names across two boundaries:
`briefing.inboxCount` → passed into a prop called `triage` → re-exported by the
widget API as `inbox_count`.

Two of those were latent bugs. The string match and the UUID match agreed only
because the seed's name and id happened to line up, so renaming the domain
would have silently desynced the Tasks-page link from the Today chip. And the
task and project domain pickers offered the Inbox as a destination, with
`triageTask` accepting it — a task could be filed *back into* the queue that
exists to empty it.

## Decision 1 — one word, and it is "Inbox"

The queue is `/inbox`. "Triage" is gone from routes, copy, props, and function
names. `/triage` permanently redirects.

"Inbox" wins over "Triage" on two counts. Practically: the row keeps its name
and UUID, so `INBOX_DOMAIN_ID`, `listInboxTasks`, `briefing.inboxCount`, every
test fixture, and the widget API's `inbox_count` are untouched — **no migration
and no external contract change**, where renaming the domain to "Triage" would
have cost all five. Semantically: an inbox is a place and a task sits *in* one,
whereas triage is a process — nothing lives "in triage" comfortably. It is also
the word every other tool uses, so it needs no explanation.

## Decision 2 — `is_system` is the categorical test

`is_system` answers "is this a real stewardship domain?" and survives a second
system row; `INBOX_DOMAIN_ID` names one specific row and is used only where
that is the point — `createTask`'s default and the queue query. The string
match is deleted.

Consequently `assertNotSystem`'s message interpolates `domain.name` instead of
hardcoding "Inbox", so a future second system row cannot produce a wrong error.

## Decision 3 — filing is one-way, enforced in the service

`triageTask` becomes `assignDomain` and **throws** when handed
`INBOX_DOMAIN_ID`. Only `createTask`'s default may ever set that domain.

The pickers filter it out too, but a UI filter is not enforcement — the
`/inbox` chips already filtered `!is_system` while the task edit form did not,
which is how the hole existed in the first place.

The pickers keep one exception: a domain that is the field's *current* value
stays listed. Otherwise editing a task that is in the Inbox would drop the
`<option>` and silently reassign it to whichever domain sorts first.

## Consequences

- `/triage` is a permanent redirect; the Tasks-page link and the Today chip
  both point at `/inbox`, and the chip's prop is named `inbox` end to end.
- The two counters now agree by construction rather than by coincidence.
- A task in the Inbox can be edited without leaving it, but can never be sent
  back once filed. Moving it between real domains is unrestricted.
- The Inbox is still typed as a stewardship domain while carrying none of the
  semantics — no `fruit_definition`, no `expected_cadence`, no
  `failure_patterns` — so consumers still special-case it out. Making
  `tasks.domain_id` nullable and deleting the row would remove that wart, at
  the cost of a schema migration. Considered and deferred.
