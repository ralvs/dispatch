-- ─────────────────────────────────────────────────────────────────────────
-- Dispatch — activity already in the ledger is read (docs/adr/0080)
-- ─────────────────────────────────────────────────────────────────────────
--
-- From ADR-0080 on, only an alert lands unread; activity (a capture filed, a
-- reminder fired) lands read. This marks the backlog the same way, so the
-- unread count means "something failed" from the first deploy.
--
-- The split mirrors lib/notification-kind.ts: an alert is a type ending in
-- `failed`, or `cron.sweep`. Dismissed rows are left alone.
--
-- Data only, no schema change: the live code keeps working before and after.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

update public.notifications
set status = 'read'
where status = 'unread'
	and type not like '%failed'
	and type <> 'cron.sweep';
