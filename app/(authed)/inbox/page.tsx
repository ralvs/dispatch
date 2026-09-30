import { Suspense } from "react";
import { PageHeader, SkeletonRows } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedInbox } from "@/lib/cache/inbox";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { InboxList } from "./inbox-list";

async function InboxBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, tasks, taskNoteIds }, domains, tz] = await Promise.all([
		getCachedInbox(),
		getCachedDomains(false),
		getCachedAppTimezone(),
	]);
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [
			{
				key: viewKey.inbox(),
				type: "taskList",
				data: { rows: tasks, scope: { unfiled: true, status: "open" } },
			},
		],
	};

	return (
		<Seed snapshot={snapshot}>
			<InboxList domains={domains} taskNoteIds={taskNoteIds} />
		</Seed>
	);
}

// Tasks captured without a domain, waiting to be given one (docs/adr/0024).
// Filing is one-way: a task leaves here and never comes back.
export default function InboxPage() {
	return (
		<div>
			{/* The subtitle survives here because it is an instruction, not a
			    tagline: filing is the whole job of the page. */}
			<PageHeader title="Inbox" subtitle="Captured tasks without a home. Give each one a domain." />

			<Suspense fallback={<SkeletonRows />}>
				<InboxBody />
			</Suspense>
		</div>
	);
}
