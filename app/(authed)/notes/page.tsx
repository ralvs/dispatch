import { Suspense } from "react";
import {
	Bone,
	DotBone,
	HeaderCreateButton,
	ListRow,
	PageSkeleton,
	repeat,
	SectionBone,
	TextBone,
	TitleMetaBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedNoteLists } from "@/lib/cache/notes";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { NoteList } from "./note-list";

async function NotesBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ readAt, needsReview, allNotes }, tz, domains] = await Promise.all([
		getCachedNoteLists(),
		getCachedAppTimezone(),
		getCachedDomains(false),
	]);
	// The lists and the review count go to the entity store (#27). The band
	// holds every flagged note, so its length is the count Today shows too.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [{ key: viewKey.notes(), type: "noteLists", data: { needsReview, all: allNotes } }],
		aggregates: { "notes.needsReview": needsReview.length },
	};

	return (
		<Seed snapshot={snapshot}>
			<NoteList
				tz={tz}
				domains={domains.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
			/>
		</Seed>
	);
}

// NoteList's silhouette: the domain filter, then one group of rows — dot,
// title over date, the pin star on the right. The review and pinned groups
// are left out: most of the time they are empty and do not render at all.
function NotesFallback() {
	return (
		<PageSkeleton
			title="Notes"
			measure={["w-16", "w-24"]}
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<HeaderCreateButton label="New note" disabled />}
		>
			<div aria-hidden="true" className="mb-4 flex items-center">
				<TextBone className="font-mono text-meta" width="w-24" />
			</div>
			<SectionBone titleWidth="w-20">
				{repeat(8, (i) => (
					<ListRow key={i} leading={<DotBone />} trailing={<Bone className="size-4 rounded-sm" />}>
						<TitleMetaBone i={i} />
					</ListRow>
				))}
			</SectionBone>
		</PageSkeleton>
	);
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// header and the lists read the entity store (#27).
export default function NotesPage() {
	return (
		<Suspense fallback={<NotesFallback />}>
			<NotesBody />
		</Suspense>
	);
}
