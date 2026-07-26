// System-row UUIDs. These are real database rows (created in the schema
// migration's seed section) but application code references them as
// constants so we don't pay a runtime lookup for routing decisions.
//
// If the seed ever needs to recreate these rows (DB rebuild, dev seed),
// the same UUIDs must be used — see the seed section of
// supabase/migrations/20260714194155_schema.sql.

// Where a task lands when it is captured without a stated destination — the
// /inbox queue (docs/adr/0024). Set by createTask's default and nothing else:
// assignDomain refuses it as a target, so filing out is one-way.
export const INBOX_DOMAIN_ID = "acf035ee-b247-4c96-a07e-5946bc2b2e91";

/** Rolling window for calendar pull syncs (iCloud CalDAV + Google). */
export const CALENDAR_SYNC_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
