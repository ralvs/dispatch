import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPushConfigured } from "@/lib/env";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { notificationKind } from "@/lib/notification-kind";
import {
	type Json,
	NOTIFICATION_SELECT,
	type NotificationRow,
	type NotificationStatus,
} from "@/lib/schemas/notification";
import { unwrap, unwrapCount } from "@/lib/services/errors";
import { sendPushToAll } from "@/lib/services/push";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Notification ledger — the sanctioned seam for iron rule #6:
// "every autonomous/external action writes a `notifications` row."
//
// Every autonomous/external caller (cron/capture/CalDAV) routes its ledger
// row through this module instead of a raw client, so "did the thing, forgot
// the row" isn't reachable through it. It does not *prevent* a caller who
// holds a SupabaseClient from bypassing it (see Known limits) — it's the
// blessed path, not a proof of impossibility.
//
// Two write paths (ADR-0015, ADR-0075):
//   - `recordNotification` is the default: best-effort, never rejects, and
//     resolves null when the row did not land (logged). Callers neither wrap
//     it nor check it — the durable record they wrote first is the point.
//   - `recordNotificationOrThrow` is for entries that ARE the delivery (a
//     fired reminder): it resolves only once the row is committed.
//
// Once a row lands, the module announces it: it busts the ledger's cache tags
// (EXTERNAL_WRITES.ledger) and delivers web push (ADR-0005). Both are
// best-effort and never reach the caller. Delivery always reads
// push_subscriptions through the service-role client, so it no longer depends
// on which `sb` the caller passed — `sb` scopes the insert only (iron rule #3).
//
// A row lands unread only when it is an alert (lib/notification-kind.ts,
// ADR-0080). Activity — a capture filed, a reminder fired — lands read: its
// push is the delivery, and the row is the record. So unread means "something
// failed", and a real failure is not buried under routine work.
//
// ── Known limits ──
//   - Not a hard boundary. Anything holding a SupabaseClient can still write
//     `notifications` (or skip it) directly; nothing at the type or DB level
//     forces traffic through this module.
//   - Never call either function from render or a "use cache" scope: the tag
//     bust belongs to route handlers and server actions.
// ─────────────────────────────────────────────────────────────────────────

export type { Json, NotificationRow, NotificationStatus };

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
 * Announce a just-committed ledger row: bust the ledger's tags, then deliver
 * web push through the service-role client. Awaited (serverless functions
 * don't outlive the response), but never rejects — neither step may turn a
 * committed row into a caller-visible error.
 */
async function announce(entry: NotificationEntry): Promise<void> {
	try {
		afterExternalMutation(...EXTERNAL_WRITES.ledger);
	} catch (err) {
		// Next throws without a request scope (tests, scripts).
		console.error("[notifications] ledger tag bust failed", err);
	}
	try {
		if (!isPushConfigured()) return;
		await sendPushToAll(createAdminClient(), {
			title: entry.title,
			body: entry.body ?? undefined,
			url: entry.source_url ?? undefined,
		});
	} catch (err) {
		console.error("[notifications] push delivery failed", err);
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
				status: notificationKind(entry.type) === "alert" ? "unread" : "read",
			})
			.select(NOTIFICATION_SELECT)
			.single(),
	);
	return data as unknown as NotificationRow;
}

/**
 * Record a ledger entry — best-effort (ADR-0015, ADR-0075). Never rejects.
 * Null when the row did not land (logged).
 */
export async function recordNotification(
	sb: SupabaseClient,
	entry: NotificationEntry,
): Promise<NotificationRow | null> {
	let notification: NotificationRow;
	try {
		notification = await insertNotification(sb, entry);
	} catch (err) {
		console.error("[notifications] ledger row did not land", entry.type, err);
		return null;
	}
	await announce(entry);
	return notification;
}

/**
 * Record a required ledger entry: resolves only after the row commits;
 * rejects (no bust, no push) when it does not.
 */
export async function recordNotificationOrThrow(
	sb: SupabaseClient,
	entry: NotificationEntry,
): Promise<NotificationRow> {
	const notification = await insertNotification(sb, entry);
	await announce(entry);
	return notification;
}

/**
 * Mark every unread alert of one type read, because the thing that failed has
 * since worked — a calendar bridge run that succeeded after a failed one
 * (ADR-0080). The rows stay on the record. Best-effort like
 * `recordNotification`: never rejects, resolves how many rows it marked, and
 * busts the ledger's tags only when it marked any. No push: nothing new
 * happened that the owner has to hear about.
 */
export async function resolveAlerts(sb: SupabaseClient, type: string): Promise<number> {
	let marked: number;
	try {
		const data = unwrap(
			await sb
				.from("notifications")
				.update({ status: "read" })
				.eq("type", type)
				.eq("status", "unread")
				.select("id"),
		);
		marked = ((data ?? []) as unknown[]).length;
	} catch (err) {
		console.error("[notifications] resolving alerts failed", type, err);
		return 0;
	}
	if (marked > 0) {
		try {
			afterExternalMutation(...EXTERNAL_WRITES.ledger);
		} catch (err) {
			console.error("[notifications] ledger tag bust failed", err);
		}
	}
	return marked;
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
	return (data ?? []) as unknown as NotificationRow[];
}

/**
 * The ledger as /notifications shows it: every unread row first — in practice
 * the alerts (ADR-0080) — then the newest of the rest, newest first within
 * each part. Unread rows are read on their own so an old failure is never cut
 * off by a page of newer activity. Dismissed rows are left out. `limit` caps
 * the whole list; unread rows take their places first.
 */
export async function listLedger(
	sb: SupabaseClient,
	opts: { limit: number },
): Promise<NotificationRow[]> {
	const [unread, rest] = await Promise.all([
		listNotifications(sb, { status: "unread", limit: opts.limit }),
		listNotifications(sb, { status: "read", limit: opts.limit }),
	]);
	return [...unread, ...rest].slice(0, opts.limit);
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
): Promise<NotificationRow | null> {
	const data = unwrap(
		await sb
			.from("notifications")
			.update({ status })
			.eq("id", id)
			.select(NOTIFICATION_SELECT)
			.maybeSingle(),
	);
	return (data ?? null) as unknown as NotificationRow | null;
}

/**
 * Flip the whole ledger at once — the "mark all read" / "dismiss all"
 * affordance, so clearing a backlog isn't one click per row.
 *
 * Scoped to rows that aren't already past the target state: marking all read
 * touches only `unread` (a dismissed row is never resurrected into `read`),
 * while dismissing takes everything still visible.
 *
 * Returns what changed, for the entity store: the rows marked read, or only
 * the ids dismissed — a dismissed row leaves every view, and a long ledger's
 * rows would be a heavy answer for no use.
 */
export async function markAllNotificationsRead(sb: SupabaseClient): Promise<NotificationRow[]> {
	const data = unwrap(
		await sb
			.from("notifications")
			.update({ status: "read" })
			.eq("status", "unread")
			.select(NOTIFICATION_SELECT),
	);
	return (data ?? []) as unknown as NotificationRow[];
}

export async function dismissAllNotifications(sb: SupabaseClient): Promise<string[]> {
	const data = unwrap(
		await sb
			.from("notifications")
			.update({ status: "dismissed" })
			.neq("status", "dismissed")
			.select("id"),
	);
	return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
