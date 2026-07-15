import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Notification ledger — the single seam for iron rule #6:
// "every autonomous/external action writes a `notifications` row."
//
// The point of this module is that performing an autonomous/external mutation
// and recording it in the ledger happen in ONE call (`recordedAction`). Future
// cron/ingest/CalDAV write paths go through this seam instead of a raw client,
// which makes rule #6 structurally hard to violate: there is no way to run the
// action here without also writing its trace.
//
// Web-push delivery (ADR-0005) slots in behind this same interface later — the
// delivery call belongs *inside* `recordedAction`/`recordNotification`, after
// the ledger row is committed, so callers never change.
// ─────────────────────────────────────────────────────────────────────────

// Mirrors exactly the `notifications` columns (supabase/migrations/0001_schema.sql).
// The table has no severity/category column — `type` is the free-text
// classifier and `status` is the read-state machine.
export type NotificationStatus = "unread" | "read" | "dismissed";

export type NotificationRow = {
	id: string;
	type: string;
	title: string;
	body: string | null;
	source_ref: string | null;
	source_url: string | null;
	status: NotificationStatus;
	undo_payload: unknown;
	created_at: string;
};

const NOTIFICATION_SELECT =
	"id, type, title, body, source_ref, source_url, status, undo_payload, created_at";

// What a caller must supply to record a ledger entry. Snake_case to match the
// columns (and the rest of the services layer, e.g. tasks.createTask).
//
//   - `type`   NOT NULL. A conventional slug describing what happened, e.g.
//              "task.created", "caldav.synced", "reminder.fired". Free text by
//              schema; keep it dot-namespaced so the read side can group later.
//   - `title`  NOT NULL. One-line human summary shown in the notification list.
//   - `undo_payload`  Optional JSON the UI can later replay to undo the action.
export type NotificationEntry = {
	type: string;
	title: string;
	body?: string | null;
	source_ref?: string | null;
	source_url?: string | null;
	undo_payload?: Record<string, unknown> | null;
};

/**
 * Raised when an autonomous action *succeeded* but writing its ledger row
 * failed. The action's side effect is real and (usually) can't be rolled back,
 * so rule #6's trace would be silently lost — this error prevents that by
 * carrying both the completed `result` and the un-written `entry` out on the
 * throw path, where the caller (cron error handler) can log or retry the
 * ledger write. Never swallow it.
 */
export class LedgerError extends ServiceError {
	readonly entry: NotificationEntry;
	readonly result: unknown;

	constructor(entry: NotificationEntry, result: unknown, cause: unknown) {
		const svc = cause instanceof ServiceError ? cause : null;
		super(
			`Action succeeded but ledger insert failed: ${svc?.message ?? String(cause)}`,
			svc?.code ?? null,
			svc?.details,
		);
		this.name = "LedgerError";
		this.entry = entry;
		this.result = result;
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
 * Perform an autonomous/external mutation and record it in the ledger as ONE
 * call. The `action` and the ledger row commit under the *same* client (`sb`),
 * so they share RLS/service-role scope — a cron path passes a service-role
 * client; a session path passes the RLS client.
 *
 * Ordering & failure semantics (there is no cross-call DB transaction in
 * supabase-js, so this is deliberate, not atomic):
 *
 *   1. The action runs FIRST, so the ledger row can describe what *actually*
 *      happened rather than what was merely intended. If the action throws,
 *      nothing is recorded — correct: nothing happened.
 *   2. The ledger insert runs SECOND. If it fails after the action succeeded,
 *      the action is NOT rolled back (external side effects generally can't
 *      be) but the trace is never dropped silently: a {@link LedgerError} is
 *      thrown carrying the action's `result` and the `entry`.
 *
 * Resolving normally therefore guarantees BOTH the action and its trace
 * committed. That invariant is the whole reason this seam exists.
 */
export async function recordedAction<T>(
	sb: SupabaseClient,
	entry: NotificationEntry,
	action: (sb: SupabaseClient) => Promise<T>,
): Promise<{ result: T; notification: NotificationRow }> {
	const result = await action(sb);

	let notification: NotificationRow;
	try {
		notification = await insertNotification(sb, entry);
	} catch (cause) {
		throw new LedgerError(entry, result, cause);
	}
	// Web-push delivery (ADR-0005) hooks in here, post-commit — callers unchanged.

	return { result, notification };
}

/**
 * Record a ledger entry with no accompanying mutation — for autonomous events
 * that are pure notifications rather than actions (a fired reminder, the daily
 * summary; the ADR-0005 push cases). The actionless degenerate of
 * {@link recordedAction}; both funnel every ledger write through this module.
 */
export async function recordNotification(
	sb: SupabaseClient,
	entry: NotificationEntry,
): Promise<NotificationRow> {
	return insertNotification(sb, entry);
	// Web-push delivery (ADR-0005) hooks in here, post-commit — callers unchanged.
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
	const { count, error } = await sb
		.from("notifications")
		.select("*", { count: "exact", head: true })
		.eq("status", "unread");
	if (error) throw new ServiceError(error.message, error.code ?? null, error.details ?? undefined);
	return count ?? 0;
}

/** Move a notification along its read-state machine (unread → read/dismissed). */
export async function markNotification(
	sb: SupabaseClient,
	id: string,
	status: "read" | "dismissed",
): Promise<void> {
	unwrap(await sb.from("notifications").update({ status }).eq("id", id));
}
