import { PageHeader } from "@/components/ui";
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
			{/* No measure: the unread count flips client-side on dismissal, and a
			    server-rendered figure beside it would be the stale one. The list
			    keeps its own reading. */}
			<PageHeader title="Notifications" />

			{/* Subtitle, bulk actions, and rows live in the client list so unread
			 * counts and dismissals flip before revalidation. */}
			<NotificationList notifications={visible} tz={tz} />
		</div>
	);
}
