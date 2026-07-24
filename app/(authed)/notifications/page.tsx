import { requireOwnerPage } from "@/lib/auth";
import { listNotifications, unreadCount } from "@/lib/services/notifications";
import { getAppTimezone } from "@/lib/services/settings";
import { BulkActions } from "./bulk-actions";
import { NotificationRow } from "./notification-row";

export default async function NotificationsPage() {
	const { sb } = await requireOwnerPage();
	const [notifications, unread, tz] = await Promise.all([
		listNotifications(sb, { limit: 100 }),
		unreadCount(sb),
		getAppTimezone(sb),
	]);
	const visible = notifications.filter((n) => n.status !== "dismissed");

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Notifications</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The ledger</h1>
				<p className="mt-1 text-meta text-ink-3">
					{unread === 0
						? "Every autonomous action, on the record. All read."
						: `Every autonomous action, on the record. ${unread} unread.`}
				</p>
				<BulkActions unread={unread} visible={visible.length} />
			</header>

			{visible.length === 0 ? (
				<p className="py-10 text-center font-serif italic text-ink-3">
					Nothing to report. The wire is quiet.
				</p>
			) : (
				<ul className="mt-4">
					{visible.map((n) => (
						<NotificationRow key={n.id} notification={n} tz={tz} />
					))}
				</ul>
			)}
		</div>
	);
}
