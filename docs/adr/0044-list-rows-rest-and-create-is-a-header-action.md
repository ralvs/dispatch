# List rows rest at 400, and create is a header action

Date: 2026-08-08

Extends ADR-0043 (the plus button is the whole capture surface on `/tasks`)
to the rest of the object lists. Closes the two gates Pass 1 left open for
`/tasks` alone.

## Context

Pass 1 dropped task titles to **400** (P1 the one step to 500) and deleted
`/tasks`'s standing capture line in favour of a bare `+` on the title. Both
arguments read as general and were applied to one surface. Eight list pages
were about to be written either way — by imitation or by leaving the
inconsistency alone.

The decision surface is `.impeccable/mocks/lists-lab.html`: `/projects` and
`/people` side by side under each option, desk and phone, light and dark.

## Decision 1 — row names rest at 400 (Gate A / A1)

Every list-row name is body size at **400**. Hierarchy on a list comes from
colour, position, and the mono meta — not from weight. The system's only
weight step is reserved for what earns it: **P1 on a task**, a `SectionHead`,
a page title.

`.type-title` (500) is no longer the row-name class. `rowTitle()` on
`ListRow` is. `/tasks` is not an exception; it was the first application of a
rule that generalises.

## Decision 2 — a list of objects opens as a list (Gate B / B1)

Creating an object is one action on the page header; the form is a dialog.
Standing `CollapsibleForm` furniture above the first row is deleted from
`/projects`, `/people`, `/quotes`, `/routines`.

The control is a labelled `+ New …` in the action slot — the `/notes` pattern.
The bare title-shoulder `+` stays `/tasks`'s: a second labelled create next to
the shell's Capture was the confusion ADR-0043 removed, and these pages live
behind More, not beside Capture.

### Where `/journal` falls

Writing the entry **is** the page, not a create action beside a list of
entries. Standing furniture is correct there for the same reason the capture
line was wrong on `/tasks`. Pass 3 applies this half of the rule; this ADR
only settles that journal is not an object-list.

## Shared geometry

`ListRow` extracts only what the nine rows genuinely share: hairline,
`min-h-12`, `py-3`, `gap-3`, leading / body / trailing. Rows keep their own
composition. A `variant` prop per surface is the failure mode.

Encoding already settled in Pass 1 and applied here:

- Domain leads left and holds its slot when absent.
- A project's own colour is not a second dot on the list row.
- Group labels are `SectionHead` (16/500), not the mono eyebrow.
- The last two legacy `hairline-strong pb-4` headers (`project-detail`,
  `person-detail`) move to `PageHeader`.

## Consequences

- Object-list create forms are dialogs; the pages open on their lists.
- `/inbox` stays its own row (title + domain buttons) — `TaskRowItem`'s
  composition is not the inbox's job. Filing remains one-way (ADR-0024);
  optimistic removal is untouched.
- `.type-title` call sites on list rows shrink; non-row uses (forms, chat
  compose) are free to keep it until they have a reason to change.
