import { Suspense } from "react";
import { PageHeader, SkeletonRows } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedNotifications } from "@/lib/cache/notifications";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { NotificationList } from "./notification-list";

async function NotificationsBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, notifications }, tz] = await Promise.all([
		getCachedNotifications(),
		getCachedAppTimezone(),
	]);
	// The list reads the entity store (#28); the view drops dismissed rows.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.notifications(), type: "notificationList", data: notifications }],
	};

	// Subtitle, bulk actions, and rows live in the client list so unread
	// counts and dismissals flip at once.
	return (
		<Seed snapshot={snapshot}>
			<NotificationList tz={tz} />
		</Seed>
	);
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
