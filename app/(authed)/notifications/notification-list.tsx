"use client";

import { EmptyState } from "@/components/ui";
import type { NotificationRow as Row } from "@/lib/schemas/notification";
import { useView, useWrites, viewKey } from "@/lib/store";
import { BulkActions } from "./bulk-actions";
import { NotificationRow } from "./notification-row";
import { notificationWrites } from "./writes";

const NO_ROWS: Row[] = [];

/**
 * Reads the ledger from the entity store (#28). Mark read, dismiss and the
 * bulk actions are intents: the list moves at once, the server's answer
 * confirms it, and a failure puts it back. Today's unread counter moves with
 * them (lib/store/kinds/notification.ts).
 */
export function NotificationList({ tz }: { tz: string }) {
	const rows = useView(viewKey.notifications()) ?? NO_ROWS;
	const { send } = useWrites();
	const unread = rows.filter((n) => n.status === "unread").length;

	function markOne(id: string, status: "read" | "dismissed") {
		send(notificationWrites.mark(id, status));
	}

	function markAll(status: "read" | "dismissed") {
		send(notificationWrites.markAll(status));
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
				<EmptyState>Nothing to report. The wire is quiet.</EmptyState>
			) : (
				<ul className="mt-4">
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
