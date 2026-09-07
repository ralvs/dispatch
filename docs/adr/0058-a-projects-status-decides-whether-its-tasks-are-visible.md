# A project's status decides whether its tasks are visible

ADR-0057 removed `tasks.someday` because a want could not carry a date. This is
what replaces it, and it is deliberately a separate ADR: the mechanism does not
live on the task at all.

**Only an *active* project's tasks reach Today and the default `/tasks`
views.** A task whose project is `paused`, `done` or `archived` is **quiet**.

Two exceptions keep the rule honest:

- **A due date always wins.** A task with a non-null `due_date` surfaces
  normally regardless of its project's status. Only undated tasks go quiet.
  This is exactly what `someday` could not do, and it is why the replacement is
  strictly more capable than the thing it replaces.
- A task with no project is never quiet. There is no project status to read.

## The case it serves

The owner's **Wish list** project (`domain = Home`) holds 4 open, undated
tasks: "Ubiquiti U7 Express + repeater", "Gaveteiro Geniodesk — R$ 1.000",
"Aqara U300 — R$ 1.000", "Ugreen charger — R$ 400". Setting that one project
to `paused` parks all four in a single gesture. Under D4 the same result took
four separate flags, and any of those four items acquiring a date would have
been a constraint violation rather than a plan.

## Where quiet applies, and where it does not

Quiet tasks are excluded from the domain open-task count and from the neglect
sweep (`lib/services/observations.ts`). The sweep exists to notice a domain
nobody has touched; deliberately parked items are not evidence of attention,
and counting them would let a wish list keep a domain looking tended forever.

They are still counted in the project's own counts (`countTasksByProject` in
`lib/services/projects.ts`), because that page's whole job is to show the
project's contents — including the parked ones.

`/tasks` keeps a filter chip, renamed from "wants" to "quiet". Nothing is
hidden without a way to look at it.

## Status stops being a label

This is the part a future reader will trip over, and the reason this decision
is not folded into ADR-0057: `projects.status` was a label and is now
behaviour. Changing a project from `active` to `paused` changes what Today
shows.

`/projects` relabels the `paused` group to **"Quiet"**. Label only — the stored
value stays `paused`, and `ProjectStatusSchema` in `lib/schemas/project.ts` is
untouched. The rename is because "paused" means *I stopped working on this*,
and a wish list never started.

## The rejected alternative

A dedicated `projects.quiet` boolean, leaving `status` a pure label. It is the
more honest model: quiet and status are two axes, and this decision welds them.

It was rejected on cost. The boolean adds a second question to every project
form — a question that would be answered once in this app's lifetime, for one
project — and reusing a column that already exists needs no migration at all.

## What this costs, and the implementation constraint

Because quiet is welded to status, **a project you are actively working on
cannot be made quiet.** The owner accepted this explicitly. The escape hatch,
if the case ever appears, is the rejected `quiet` boolean, which is a small
migration away and can be added without unpicking any of this.

The other cost is in the query, and it is non-obvious enough to record.
`someday` was one column on `tasks`, so the filter was one line:
`.eq("someday", false)`. Project status lives on another table, and the obvious
PostgREST translation — an embedded `!inner` join filter on `projects` — would
silently drop every task with a null `project_id`, which is the majority and
which the rule says is never quiet. So the filter instead reads the small set
of non-active project ids first, then excludes undated tasks in that set. Two
round trips where there was one line, in exchange for a mechanism that does not
lie about dates.
