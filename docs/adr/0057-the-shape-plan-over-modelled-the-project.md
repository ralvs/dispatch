# The shape plan over-modelled the project

Two removals, one argument. `tasks.someday` goes, and so do `projects.type`
and `projects.kind`. All three describe the work instead of doing anything to
it, and in each case the production data says the description was never true.

## `tasks.someday` lasted one day

Plan decision D4 — "a want is a task with the clock switched off" — shipped on
6 Sep 2026 in commit `40d0ace`, migration
`supabase/migrations/20260906130000_tasks_someday.sql`. It is removed on
7 Sep 2026. Production has **0** rows with `someday = true`, so nothing is
lost, but the reason it is going is not the row count.

The owner's stated objection was the switch in the task form: a "someday"
toggle that disabled due date, due time and repeats together. That is the
symptom. The cause is one line of the migration:

```sql
check (not someday or due_date is null)
```

A want could not carry a date at all, enforced in the database so no writer
could produce one. But "Buy a PlayStation for Christmas" is a real open task in
production, due 2026-11-03 — a thing the owner is not working on now, that
nonetheless has a date attached to it. Under D4 it could never have been a
want. A parking mechanism that cannot express a date is the wrong mechanism,
and the form switch was only where that showed.

ADR-0058 replaces it with a rule that keeps dates: an undated task in a
non-active project goes quiet, a dated one never does.

## `projects.type` and `projects.kind` were badges

Neither column was ever read for behaviour. `kind` carried a comment in
`lib/schemas/project.ts` distinguishing a finite project from an ongoing area;
nothing branched on it. Both rendered as a badge and stopped there.

The argument for removing them rather than giving them a better vocabulary is
the production data. Every project maps cleanly to its domain:

| Domain | Projects |
| --- | --- |
| Code | Clarifi, Dispatch, Echo, Worthscene |
| Engine | AI clean up, Hydra deployment per PR, ISO date URL, Lore |
| Home | Wish list |

Engine is the owner's employer, Code is his own projects, Home is life. Zero
exceptions. So a `type` of "work / personal / …" would restate `domain` and
ask the same question twice on one form. The stored values corroborate that
the vocabulary was already dead on arrival: 8 of 9 projects carried
`type = 'internal'` and the ninth was null; `kind` was 8 `project` and 1
`area`.

This is also the property `PRODUCT.md` claims as distinguishing: "Stewardship
domains, not projects. Work is organized by long-lived areas of
responsibility." Plan §02 says a project is "a loose bucket that tags tasks —
nothing more". Giving the loose bucket its own taxonomy rebuilds the thing the
product deliberately refused, one form field at a time.

## The rejected alternative

Keep `type`, re-vocabularised to fit the owner's actual workflow: work /
personal / wish-list. Rejected because only one of those words would have
carried behaviour, and that word is "quiet" — which is not a category. Quiet
answers *does this nag me*; work and personal answer *what is this*. Two axes
crammed into one enum, with the useful axis buried among labels. ADR-0058
takes the useful axis and leaves the labels behind.

## What this costs

The migration is not reversible. There is no down script, following the
ADR-0056 precedent: restoring means a point-in-time restore, which is the
honest position for a drop.

`kind` is the one column that held information — the Wish list was the only
`area`, and that is a real distinction. It survives in a better place: under
ADR-0058 the Wish list is a non-active project, which is what "ongoing context
I am not working through" meant in the first place, and which now changes what
the app shows instead of only what the badge says.
