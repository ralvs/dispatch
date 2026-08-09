"use client";

import { Button, ListRow, rowTitle } from "@/components/ui";
import { formatInstant } from "@/lib/dates";
import type { NotificationRow as Row } from "@/lib/services/notifications";

export function NotificationRow({
	notification,
	tz,
	onMarkRead,
	onDismiss,
}: {
	notification: Row;
	tz: string;
	onMarkRead: () => void;
	onDismiss: () => void;
}) {
	const unread = notification.status === "unread";

	return (
		<ListRow
			align="start"
			trailing={
				<p className="shrink-0 font-mono text-meta text-ink-4">
					{formatInstant(notification.created_at, tz)}
				</p>
			}
		>
			<p className="flex items-center gap-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
				{unread && <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-pill bg-accent" />}
				{notification.type}
				{unread && <span className="sr-only"> (unread)</span>}
			</p>
			<p
				className={rowTitle({
					tone: unread ? "default" : "muted",
					// The body wraps to as many lines as it needs; no truncation.
					layout: "bare",
					className: "mt-1",
				})}
			>
				{notification.title}
			</p>
			{notification.body && <p className="mt-1 text-meta text-ink-3">{notification.body}</p>}
			<div className="mt-2 flex items-center gap-2">
				{notification.source_url && (
					<a
						href={notification.source_url}
						className="inline-flex h-7 items-center px-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink active:opacity-70"
					>
						Open →
					</a>
				)}
				{unread && (
					<Button type="button" variant="tertiary" size="sm" onClick={onMarkRead}>
						Mark read
					</Button>
				)}
				<Button type="button" variant="tertiary" size="sm" onClick={onDismiss}>
					Dismiss
				</Button>
			</div>
		</ListRow>
	);
}
