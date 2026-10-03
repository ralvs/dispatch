import { Suspense } from "react";
import { ListRow, PageHeader, PillBone, repeat, SkeletonStatus, TextBone } from "@/components/ui";
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

// InboxRow's silhouette: the title, then the domain chips it is filed with
// and the delete pill on the right.
function InboxFallback() {
	const chips = ["w-16", "w-20", "w-14", "w-24", "w-16", "w-20"];
	return (
		<>
			<SkeletonStatus />
			<ul aria-hidden="true" className="mt-4">
				{repeat(4, (i) => (
					<ListRow key={i} align="start">
						<TextBone
							className="text-base leading-[1.35]"
							width={["w-48", "w-64", "w-40", "w-56"][i]}
						/>
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							{chips.map((w, j) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder.
								<PillBone key={j} width={w} />
							))}
							<span className="ml-auto">
								<PillBone width="w-[72px]" />
							</span>
						</div>
					</ListRow>
				))}
			</ul>
		</>
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

			<Suspense fallback={<InboxFallback />}>
				<InboxBody />
			</Suspense>
		</div>
	);
}
