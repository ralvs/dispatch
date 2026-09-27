import { Suspense } from "react";
import { PageHeader, SkeletonRows } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedNotifications } from "@/lib/cache/notifications";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { NotificationList } from "./notification-list";

async function NotificationsBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [notifications, tz] = await Promise.all([getCachedNotifications(), getCachedAppTimezone()]);
	const visible = notifications.filter((n) => n.status !== "dismissed");

	// Subtitle, bulk actions, and rows live in the client list so unread
	// counts and dismissals flip before revalidation.
	return <NotificationList notifications={visible} tz={tz} />;
}

export default function NotificationsPage() {
	return (
		<div>
			{/* No measure: the unread count flips client-side on dismissal, and a
			    server-rendered figure beside it would be the stale one. The list
			    keeps its own reading. */}
			<PageHeader title="Notifications" />

			<Suspense fallback={<SkeletonRows />}>
				<NotificationsBody />
			</Suspense>
		</div>
	);
}
