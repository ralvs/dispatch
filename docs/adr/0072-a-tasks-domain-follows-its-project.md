# A task's domain follows its project, in the database

Date: 2026-10-02

A task in a project must be filed in that project's domain. The rule lived in
the app, on two of its write paths: capture (`resolveTaskRouting`, the project
wins) and the form's title-only path (`withStatedDomain`, a stated domain wins
and the project is dropped). The form's own create and edit only disabled the
domain control, `assignDomain` checked nothing, and a project moving to another
domain left its tasks behind. Any caller of `updateTaskAction` could store a
project under another domain.

## Decision

1. **The database holds the rule**
   (`supabase/migrations/20261002120000_task_domain_follows_project.sql`). A
   `before insert or update of project_id, domain_id` trigger on `tasks` sets
   `domain_id` to the project's whenever `project_id` is set. An
   `after update of domain_id` trigger on `projects` moves its tasks along. The
   migration fixes the rows written before it.
2. **The project wins.** It is what the form shows (picking a project locks the
   domain) and what capture already did. A write that names only a domain
   cannot pull a task away from its project's; leaving the project is the way.
3. **The precedence rules stay in the app.** They decide which project a
   capture keeps, before the write: `withStatedDomain` must still drop a
   project that contradicts a stated domain, or the trigger would overrule
   what the operator said.

## Considered

- **A check in `createTask` and `updateTask`.** Two more app paths, and still
  not `assignDomain`, the project move, or a raw client. Each needs a read of
  the project first.
- **A check constraint, rejecting the write.** A constraint cannot read another
  table, and a rejection would fail a capture (iron rule #4) where a
  correction cannot.

## Consequences

- Every write path is covered by one rule and one integration test suite
  (`lib/services/tasks.int.test.ts`).
- A project's domain change moves its tasks on the server, but the entity
  store does not hear of it: the moved tasks show their old domain in an open
  tab until the next seed.
- A domain-only write to a task in a project is silently corrected, not
  refused. The UI never sends one.
