// The notification kind (#28). Rows are written from outside the app (iron
// rule #6), so new ones arrive only through seeds; the client only changes a
// row's status. A status is desired state, so a replayed write is idempotent.
//
// A dismissed row leaves every view for good, so the store treats it as gone:
// a dismissal's write carries the id as deleted, not the row. That keeps
// "dismiss all" on a long ledger an id list, not a page of rows.

import type { NotificationRow } from "@/lib/schemas/notification";
import type {
	AggregateKey,
	Deltas,
	IntentCtx,
	KindAdapter,
	RowEntry,
	ViewAdapter,
} from "@/lib/store/types";

export type NotificationIntent =
	| { type: "mark"; id: string; status: "read" | "dismissed" }
	| { type: "markAll"; status: "read" | "dismissed" };

/** The list after the intent. Shared by the view adapter and its tests. */
export function applyNotificationIntent(
	list: NotificationRow[],
	intent: NotificationIntent,
): NotificationRow[] {
	if (intent.type === "mark") {
		if (intent.status === "dismissed") {
			return list.some((n) => n.id === intent.id) ? list.filter((n) => n.id !== intent.id) : list;
		}
		return list.some((n) => n.id === intent.id && n.status === "unread")
			? list.map((n) => (n.id === intent.id ? { ...n, status: "read" as const } : n))
			: list;
	}
	if (intent.status === "dismissed") return list.length === 0 ? list : [];
	return list.some((n) => n.status === "unread")
		? list.map((n) => (n.status === "unread" ? { ...n, status: "read" as const } : n))
		: list;
}

/**
 * The unread count (Today's counter) moves with the intent. One row moves it
 * by one, and only if the row was unread. Either bulk action leaves nothing
 * unread, so it takes the count to zero — the count includes rows this tab
 * never loaded, which only the aggregate knows about.
 */
function notificationDeltas(
	intent: NotificationIntent,
	before: NotificationRow | undefined,
	_ctx: IntentCtx,
	current: (key: AggregateKey) => number | undefined,
): Deltas {
	if (intent.type === "mark") {
		return before?.status === "unread" ? { "notifications.unread": -1 } : {};
	}
	const unread = current("notifications.unread") ?? 0;
	return unread > 0 ? { "notifications.unread": -unread } : {};
}

export const notificationKind: KindAdapter<"notification"> = {
	idOf: (row) => row.id,
	targetId: (intent) => (intent.type === "mark" ? intent.id : undefined),
	provisionalIds: () => [],
	deltas: notificationDeltas,
};

function without(rows: NotificationRow[], ids: ReadonlySet<string>): NotificationRow[] {
	return rows.some((r) => ids.has(r.id)) ? rows.filter((r) => !ids.has(r.id)) : rows;
}

export const notificationListView: ViewAdapter<"notificationList"> = {
	kind: "notification",
	fromSeed: (data) => ({ base: data.filter((n) => n.status !== "dismissed"), params: undefined }),
	rowsOf: (view) => view,
	reduce: (view, intent) => applyNotificationIntent(view, intent),
	upsert: (view, rows) => {
		// Never admits a row: the client creates none, and a bulk write can carry
		// rows older than the newest 100 this list holds.
		let out = view;
		for (const row of rows) {
			const i = out.findIndex((r) => r.id === row.id);
			if (i === -1) continue;
			out =
				row.status === "dismissed"
					? out.filter((r) => r.id !== row.id)
					: out.map((r) => (r.id === row.id ? row : r));
		}
		return out;
	},
	remove: (view, ids) => without(view, ids),
	patch: (view, rowOf) => {
		let changed = false;
		const out: NotificationRow[] = [];
		for (const row of view) {
			const entry: RowEntry<NotificationRow> | undefined = rowOf(row.id);
			if (entry === undefined) {
				out.push(row);
			} else if ("deleted" in entry || entry.row.status === "dismissed") {
				changed = true;
			} else {
				if (entry.row !== row) changed = true;
				out.push(entry.row);
			}
		}
		return changed ? out : view;
	},
};
