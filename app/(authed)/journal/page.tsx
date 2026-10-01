import { Suspense } from "react";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedJournal } from "@/lib/cache/journal";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { JournalList } from "./journal-list";

async function JournalBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [tz, { readAt, entries }] = await Promise.all([getCachedAppTimezone(), getCachedJournal()]);
	// The header, the day groups and the rows read the entity store (#30).
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.journal(), type: "journalList", data: { rows: entries } }],
	};

	return (
		<Seed snapshot={snapshot}>
			<JournalList />
		</Seed>
	);
}

function JournalFallback() {
	return <PageSkeleton title="Journal" />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child seeds the entity store (#30).
export default function JournalPage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<JournalFallback />}>
				<JournalBody />
			</Suspense>
		</div>
	);
}
