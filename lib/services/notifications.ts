import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Notification ledger — the sanctioned seam for iron rule #6:
// "every autonomous/external action writes a `notifications` row."
//
// The point of this module is that performing an autonomous/external mutation
// and recording it in the ledger happen in ONE call (`recordedAction`). Future
// cron/ingest/CalDAV write paths are expected to go through this seam instead
// of a raw client: it is the one path that records a trace by construction, so
// "did the action, forgot the row" isn't reachable through it. It does not
// *prevent* a caller who holds a SupabaseClient from bypassing it (see Known
// limits) — it's the blessed path, not a proof of impossibility.
//
// Web-push delivery (ADR-0005) is planned, not built: when it lands, the
// delivery call belongs *inside* `recordedAction`/`recordNotification`, after
// the ledger row is committed, so callers never change.
//
// ── Known limits (the first real cron/ingest caller must resolve these) ──
//   - Not atomic / not crash-safe. There is no cross-call DB transaction in
//     supabase-js, so a crash between the action and the ledger insert loses
//     the trace, and a blind retry of the whole call may repeat the action.
//     The first autonomous caller must bring an idempotency key (dedupe the
//     action) and a reconciliation decision (how an orphaned action gets its
//     row) with it — do not add generic machinery here speculatively.
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
 * call. The ledger `entry` is derived FROM the action's result (`entryFor`),
 * so it can describe what actually happened — the created row's id in
 * `source_ref`, a real count in the title — which a pre-built entry could not.
 *
 * The `action` and the ledger row run under the *same* client (`sb`), so they
 * share RLS/service-role scope — a cron path passes a service-role client; a
 * session path passes the RLS client.
 *
 * Ordering & failure semantics (deliberate, not atomic — see Known limits):
 *
 *   1. The action runs FIRST; its result feeds `entryFor`. If the action
 *      throws, nothing is recorded — correct: nothing happened.
 *   2. The ledger insert runs SECOND. If it fails after the action succeeded,
 *      the action is NOT rolled back (external side effects generally can't
 *      be) but the trace is never dropped silently: a {@link LedgerError} is
 *      thrown carrying the action's `result` and the derived `entry`.
 *
 * Resolving normally therefore means BOTH the action and its trace committed.
 * That is the guarantee this seam is here to provide.
 */
export async function recordedAction<T>(
	sb: SupabaseClient,
	action: (sb: SupabaseClient) => Promise<T>,
	entryFor: (result: T) => NotificationEntry,
): Promise<{ result: T; notification: NotificationRow }> {
	const result = await action(sb);
	const entry = entryFor(result);

	let notification: NotificationRow;
	try {
		notification = await insertNotification(sb, entry);
	} catch (cause) {
		throw new LedgerError(entry, result, cause);
	}
	// Web-push delivery (ADR-0005, planned) will hook in here, post-commit.

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
	// Web-push delivery (ADR-0005, planned) will hook in here, post-commit.
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
