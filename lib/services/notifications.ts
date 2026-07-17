import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap, unwrapCount } from "@/lib/services/errors";
import { sendPushToAll } from "@/lib/services/push";

// ─────────────────────────────────────────────────────────────────────────
// Notification ledger — the sanctioned seam for iron rule #6:
// "every autonomous/external action writes a `notifications` row."
//
// `recordNotification` is the one sanctioned write path: every autonomous/
// external caller (cron/ingest/CalDAV) is expected to route its ledger row
// through it instead of a raw client, so "did the thing, forgot the row"
// isn't reachable through this module. It does not *prevent* a caller who
// holds a SupabaseClient from bypassing it (see Known limits) — it's the
// blessed path, not a proof of impossibility.
//
// Web-push delivery (ADR-0005) is planned, not built: when it lands, the
// delivery call belongs *inside* `recordNotification`, after the ledger row
// is committed, so callers never change.
//
// ── Known limits ──
//   - Not a hard boundary. Anything holding a SupabaseClient can still write
//     `notifications` (or skip it) directly; nothing at the type or DB level
//     forces traffic through this module. Enforcement (e.g. an import-boundary
//     lint) is deferred until there are callers to protect.
// ─────────────────────────────────────────────────────────────────────────

// Any JSON value — the honest domain of a jsonb column.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Mirrors exactly the `notifications` columns (supabase/migrations/0001_schema.sql).
// The table has no severity/category column — `type` is the free-text
// classifier and `status` is the read state.
export type NotificationStatus = "unread" | "read" | "dismissed";

export type NotificationRow = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	source_ref: string | null;
	source_url: string | null;
	status: NotificationStatus;
	undo_payload: Json | null;
	created_at: string;
};

const NOTIFICATION_SELECT =
	"id, type, title, body, source_ref, source_url, status, undo_payload, created_at";

// What a caller supplies to record a ledger entry. Snake_case to match the
// columns (and the rest of the services layer, e.g. tasks.createTask).
//
//   - `type`   NOT NULL. A conventional slug describing what happened, e.g.
//              "task.created", "caldav.synced", "reminder.fired". Free text by
//              schema; keep it dot-namespaced so the read side can group later.
//   - `title`  NOT NULL. One-line human summary shown in the notification list.
//   - `undo_payload`  Optional JSON object the UI can later replay to undo the
//              action. Typed as an object (not any Json) because every real
//              undo payload is a keyed record, e.g. `{ table, id, prev }`.
export type NotificationEntry = {
	type: string;
	title: string;
	body?: string | null;
	source_ref?: string | null;
	source_url?: string | null;
	undo_payload?: { [key: string]: Json } | null;
};

/**
 * Best-effort web-push delivery for a just-committed ledger row (ADR-0005).
 * Awaited (not fire-and-forget — serverless functions don't outlive the
 * response), but never allowed to throw or reject into the caller: a push
 * failure must never turn a successful ledger write into a caller-visible
 * error.
 */
async function pushNotification(sb: SupabaseClient, entry: NotificationEntry): Promise<void> {
	try {
		await sendPushToAll(sb, {
			title: entry.title,
			body: entry.body ?? undefined,
			url: entry.source_url ?? undefined,
		});
	} catch {
		// Never surface a push failure to the caller of recordNotification.
	}
}

async function insertNotification(
	sb: SupabaseClient,
	entry: NotificationEntry,
): Promise<NotificationRow> {
	const data = unwrap(
		await sb
			.from("notifications")
			.insert({
				type: entry.type,
				title: entry.title,
				body: entry.body ?? null,
				source_ref: entry.source_ref ?? null,
				source_url: entry.source_url ?? null,
				undo_payload: entry.undo_payload ?? null,
			})
			.select(NOTIFICATION_SELECT)
			.single(),
	);
	return data as NotificationRow;
}

/**
 * Record a ledger entry — the one sanctioned write path for iron rule #6.
 * Every autonomous/external event (a completed mutation, a fired reminder,
 * the daily summary) funnels through this call so a `notifications` row is
 * never forgotten by construction.
 */
export async function recordNotification(
	sb: SupabaseClient,
	entry: NotificationEntry,
): Promise<NotificationRow> {
	const notification = await insertNotification(sb, entry);
	// Web-push delivery (ADR-0005). `sb` is RLS-scoped on session paths (server
	// actions/route handlers via requireOwner()), and push_subscriptions has RLS
	// enabled with no policies — so that select silently returns zero rows there.
	// Only a service-role `sb` (cron/ingest/autonomous callers) actually pushes.
	await pushNotification(sb, entry);
	return notification;
}

// ─── Read / update surface ─────────────────────────────────────────────────
// Implied directly by the table's `status` enum and idx_notifications_status_time.

export async function listNotifications(
	sb: SupabaseClient,
	opts: { status?: NotificationStatus; limit?: number } = {},
): Promise<NotificationRow[]> {
	let q = sb
		.from("notifications")
		.select(NOTIFICATION_SELECT)
		.order("created_at", { ascending: false });
	if (opts.status) q = q.eq("status", opts.status);
	if (opts.limit != null) q = q.limit(opts.limit);
	const data = unwrap(await q);
	return (data ?? []) as NotificationRow[];
}

/** Count of unread notifications — the badge number. */
export async function unreadCount(sb: SupabaseClient): Promise<number> {
	return unwrapCount(
		await sb
			.from("notifications")
			.select("*", { count: "exact", head: true })
			.eq("status", "unread"),
	);
}

/**
 * Set a notification's read state. Any status is reachable from any other —
 * `unread` can go straight to `dismissed` without passing through `read`.
 */
export async function markNotification(
	sb: SupabaseClient,
	id: string,
	status: "read" | "dismissed",
): Promise<void> {
	unwrap(await sb.from("notifications").update({ status }).eq("id", id));
}
