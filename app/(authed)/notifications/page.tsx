import { Suspense } from "react";
import {
	ListRow,
	MoreBackLink,
	PageHeader,
	PillBone,
	ragged,
	repeat,
	SkeletonStatus,
	TextBone,
} from "@/components/ui";
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
	const [{ readAt, notifications, unread }, tz] = await Promise.all([
		getCachedNotifications(),
		getCachedAppTimezone(),
	]);
	// The list reads the entity store (#28); the view drops dismissed rows. The
	// unread count is seeded here too, so a bulk action taken before Today was
	// ever opened still takes Today's counter to zero.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.notifications(), type: "notificationList", data: notifications }],
		aggregates: { "notifications.unread": unread },
	};

	// Subtitle, bulk actions, and rows live in the client list so unread
	// counts and dismissals flip at once.
	return (
		<Seed snapshot={snapshot}>
			<NotificationList tz={tz} />
		</Seed>
	);
}

// NotificationList's silhouette: the summary line and bulk pills, then rows
// of type eyebrow, title, body, action pills, and the time on the right.
function NotificationsFallback() {
	return (
		<>
			<SkeletonStatus />
			<div aria-hidden="true">
				<TextBone className="mt-1 text-meta" width="w-72" />
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<PillBone width="w-[130px]" />
					<PillBone width="w-[114px]" />
				</div>
				<ul className="mt-4">
					{repeat(5, (i) => (
						<ListRow
							key={i}
							align="start"
							trailing={<TextBone className="font-mono text-meta" width="w-20" />}
						>
							<TextBone className="font-mono text-eyebrow" width="w-20" />
							<TextBone className="mt-1 text-base leading-[1.35]" width={ragged(i + 1)} />
							{i % 3 !== 1 && <TextBone className="mt-1 text-meta" width={ragged(i + 4)} />}
							<div className="mt-2 flex items-center gap-2">
								<PillBone width="w-[98px]" />
								<PillBone width="w-20" />
							</div>
						</ListRow>
					))}
				</ul>
			</div>
		</>
	);
}

export default function NotificationsPage() {
	return (
		<div>
			<MoreBackLink />
			{/* No measure: the unread count flips client-side on dismissal, and a
			    server-rendered figure beside it would be the stale one. The list
			    keeps its own reading. */}
			<PageHeader title="Notifications" />

			<Suspense fallback={<NotificationsFallback />}>
				<NotificationsBody />
			</Suspense>
		</div>
	);
}
