// System-row UUIDs. These are real database rows (created in the schema
// migration's seed section) but application code references them as
// constants so we don't pay a runtime lookup for routing decisions.
//
// If the seed ever needs to recreate these rows (DB rebuild, dev seed),
// the same UUIDs must be used — see supabase/migrations/0001_schema.sql.

// Catch-all domain for tasks captured without an explicit destination.
export const INBOX_DOMAIN_ID = "acf035ee-b247-4c96-a07e-5946bc2b2e91";
