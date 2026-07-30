import { requireOwnerPage } from "@/lib/auth";
import { listNotifications } from "@/lib/services/notifications";
import { getAppTimezone } from "@/lib/services/settings";
import { NotificationList } from "./notification-list";

export default async function NotificationsPage() {
	const { sb } = await requireOwnerPage();
	const [notifications, tz] = await Promise.all([
		listNotifications(sb, { limit: 100 }),
		getAppTimezone(sb),
	]);
	const visible = notifications.filter((n) => n.status !== "dismissed");

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Notifications</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The ledger</h1>
			</header>

			{/* Subtitle, bulk actions, and rows live in the client list so unread
			 * counts and dismissals flip before revalidation. */}
			<NotificationList notifications={visible} tz={tz} />
		</div>
	);
}
