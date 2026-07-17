"use client";

import { useTransition } from "react";
import { markNotificationAction } from "@/app/(authed)/notifications/actions";
import { formatInstant } from "@/lib/dates";
import type { NotificationRow as Row } from "@/lib/services/notifications";

export function NotificationRow({ notification, tz }: { notification: Row; tz: string }) {
	const [pending, startTransition] = useTransition();
	const unread = notification.status === "unread";

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<div className="flex items-baseline justify-between gap-4">
				<p className="flex items-baseline gap-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					{unread && (
						<span aria-hidden className="inline-block h-1.5 w-1.5 self-center bg-accent" />
					)}
					{notification.type}
					{unread && <span className="sr-only"> (unread)</span>}
				</p>
				<p className="shrink-0 font-mono text-meta text-ink-4">
					{formatInstant(notification.created_at, tz)}
				</p>
			</div>
			<p className={`mt-1 text-sm ${unread ? "text-ink" : "text-ink-2"}`}>{notification.title}</p>
			{notification.body && <p className="mt-1 text-meta text-ink-3">{notification.body}</p>}
			<div className="mt-2 flex items-baseline gap-3">
				{notification.source_url && (
					<a
						href={notification.source_url}
						className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
					>
						Open →
					</a>
				)}
				{unread && (
					<button
						type="button"
						disabled={pending}
						onClick={() => startTransition(() => markNotificationAction(notification.id, "read"))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Mark read
					</button>
				)}
				<button
					type="button"
					disabled={pending}
					onClick={() =>
						startTransition(() => markNotificationAction(notification.id, "dismissed"))
					}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					Dismiss
				</button>
			</div>
		</li>
	);
}
