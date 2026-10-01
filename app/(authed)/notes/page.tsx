import { Suspense } from "react";
import { HeaderCreateButton, PageSkeleton } from "@/components/ui";
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

function NotesFallback() {
	return (
		<PageSkeleton
			title="Notes"
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<HeaderCreateButton label="New note" disabled />}
		/>
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
