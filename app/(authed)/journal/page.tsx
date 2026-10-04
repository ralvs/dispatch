import { Suspense } from "react";
import {
	ListRow,
	MoreBackLink,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	SectionBone,
	TextBone,
	TriggerBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedJournal } from "@/lib/cache/journal";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
import { JournalList } from "./journal-list";

async function JournalBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [clock, read] = await Promise.all([readClock(), getCachedJournal()]);
	const { entries } = read.data;
	// The header, the day groups and the rows read the entity store (#30).
	const snapshot = seedOf(read, clock, {
		views: [{ key: viewKey.journal(), type: "journalList", data: { rows: entries } }],
	});

	return (
		<Seed snapshot={snapshot}>
			<JournalList />
		</Seed>
	);
}

// JournalList's silhouette: the collapsed "+ New entry" trigger, then a few
// date groups of one entry each with its DELETE pill.
function JournalFallback() {
	return (
		<PageSkeleton title="Journal" measure={["w-16"]}>
			<div aria-hidden="true" className="measure-prose">
				<TriggerBone labelWidth="w-20" />
			</div>
			<div className="mt-9">
				<div>
					{repeat(3, (i) => (
						<SectionBone key={i} titleWidth="w-56">
							<ListRow trailing={<PillBone width="w-[72px]" />}>
								<TextBone className="text-base leading-[1.35]" width={ragged(i + 2)} />
							</ListRow>
						</SectionBone>
					))}
				</div>
			</div>
		</PageSkeleton>
	);
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
