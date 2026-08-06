"use client";

import { useOptimistic, useTransition } from "react";
import {
	markAllNotificationsAction,
	markNotificationAction,
} from "@/app/(authed)/notifications/actions";
import { runAction } from "@/lib/client/toast";
import type { NotificationRow as Row } from "@/lib/services/notifications";
import { BulkActions } from "./bulk-actions";
import { NotificationRow } from "./notification-row";

type Intent =
	| { type: "one"; id: string; status: "read" | "dismissed" }
	| { type: "all"; status: "read" | "dismissed" };

function applyIntent(list: Row[], intent: Intent): Row[] {
	if (intent.type === "one") {
		if (intent.status === "dismissed") return list.filter((n) => n.id !== intent.id);
		return list.map((n) => (n.id === intent.id ? { ...n, status: "read" as const } : n));
	}
	if (intent.status === "dismissed") return [];
	return list.map((n) => (n.status === "unread" ? { ...n, status: "read" as const } : n));
}

/**
 * Owns useOptimistic for mark-read / dismiss / bulk so the ledger updates
 * before the RSC revalidation lands.
 */
export function NotificationList({
	notifications,
	tz,
}: {
	/** Visible rows only (already filtered past dismissed). */
	notifications: Row[];
	tz: string;
}) {
	const [, startTransition] = useTransition();
	const [rows, dispatch] = useOptimistic(notifications, applyIntent);
	const unread = rows.filter((n) => n.status === "unread").length;

	function markOne(id: string, status: "read" | "dismissed") {
		startTransition(async () => {
			dispatch({ type: "one", id, status });
			await runAction(() => markNotificationAction(id, status), "Couldn't update notification.");
		});
	}

	function markAll(status: "read" | "dismissed") {
		startTransition(async () => {
			dispatch({ type: "all", status });
			await runAction(() => markAllNotificationsAction(status), "Couldn't update notifications.");
		});
	}

	return (
		<>
			<p className="mt-1 text-meta text-ink-3">
				{unread === 0
					? "Every autonomous action, on the record. All read."
					: `Every autonomous action, on the record. ${unread} unread.`}
			</p>
			<BulkActions
				unread={unread}
				visible={rows.length}
				onMarkAllRead={() => markAll("read")}
				onDismissAll={() => markAll("dismissed")}
			/>

			{rows.length === 0 ? (
				<p className="py-10 text-center font-serif italic text-ink-3">
					Nothing to report. The wire is quiet.
				</p>
			) : (
				<ul className="list-card mt-3">
					{rows.map((n) => (
						<NotificationRow
							key={n.id}
							notification={n}
							tz={tz}
							onMarkRead={() => markOne(n.id, "read")}
							onDismiss={() => markOne(n.id, "dismissed")}
						/>
					))}
				</ul>
			)}
		</>
	);
}
