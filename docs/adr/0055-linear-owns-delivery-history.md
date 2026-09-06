# Linear owns delivery history; Dispatch owns attention

`AGENTS.md` requires a new ADR "whenever a decision deviates from the
reference implementation". The shape plan
(`docs/plan-dispatch-shape-2026-08-21.html`) is one long deviation, so this
records what was taken from the jerad-ops 2.0 read
(`docs/review-jerad-ops-v2-2026-08-15.html`), what was refused, and the one
sentence the refusals all follow from.

## The two apps do not share a job

Dispatch is a functional reimplementation of jerad-ops and shares its whole
vocabulary — domain, project, task, note. It does not share what the app is
*for*.

**jerad-ops has to** prove what was delivered to a client and when, hold hours
against a quote per retainer cycle, keep a per-project update log, track owned
gear for insurance and resale, and notice a client who has gone silent. Every
one of those is a record kept for someone else's benefit.

**Dispatch has to** catch a thought before it is lost, hold the work thinking
that is not yet a Linear ticket, hold home and family errands, notice a part of
life nobody has touched in a while, and keep the journal, quotes, notes and
people around all of it. Renan is an employee; his project and ticket history
already lives in Linear, inside the company's walls.

**Linear owns delivery history. Dispatch owns attention.**

## The consequence

The agency column is not a Dispatch feature that was never finished — it is a
Dispatch feature that should never exist. `activity_log`, `inventory_items`,
`projects.client_id`, `quoted_hours`, `hours_logged` and `engagement_type` are
all in that column, and P5 retired every one of them that had code.

Milestones went for a different reason: a percentage that only moves when you
tick an invented checklist item measures the checklist, not the work. Progress
is the project's own tasks now (decision D2).

Everything retired is retired **in code only** (plan §08 Phase A). The rows are
untouched in Postgres and reachable. Dropping them is a later, separate patch
with its own ADR, following the ADR-0007 precedent, and it is not scheduled.

## What was taken

- The neglect sweep (P1) — a repair, not an addition: the product already
  promised this cron in writing and did not have one.
- Facts on `/domains` rows, and the stat band (P2, ADR-0053).
- A domain on notes (P3), wants (P4), a usable project tag (P6), a custom
  weekly repeat (P7), routine edit and backfill (P8, ADR-0054).

## What was refused, and why it is written down

Refusals are the point, so they are recorded rather than left as silence:

- **Copying the reference UI.** The gap was information, not looks.
- **Changing Today's page.** Ruled out directly; the sweep routes around it.
- **A third task status ("waiting on").** Waiting on someone else is a
  client-work problem, and Linear holds the tickets that block.
- **Computed project urgency.** A project is a tag now; a tag has no health.
- **Silence tracking on People.** Real, but nothing asked for it.
- **Hours, quotes, retainers, clients.** The whole argument above.
- **An inventory or asset register.** Insurance records, not a wish list.
- **Tomorrow's Focus / the Daily Rule.** `top3_for_date` is already the better
  version of the focus pointer.
