-- docs/plan-dispatch-shape-2026-08-21.html §02, P3: a note gets an optional
-- domain.
--
-- Optional, not required, and with no Inbox fallback: "a loose thought stays
-- loose" (decision D1). `related_project_id` is untouched — a note may carry
-- both, neither, or either.
--
-- on delete set null matches projects.domain_id: archiving or deleting a
-- domain must never take notes with it.
--
-- Consequence recorded in plan O3: once notes carry a domain they become a
-- source for the neglect sweep's last-touch date, and they were agreed to
-- count. Thinking about something is attention, which is what that measure is
-- for.

alter table notes
  add column if not exists domain_id uuid
    references stewardship_domains(id) on delete set null;

create index if not exists idx_notes_domain on notes(domain_id)
  where domain_id is not null;
