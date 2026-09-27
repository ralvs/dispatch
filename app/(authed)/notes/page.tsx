import { Suspense } from "react";
import { HeaderCreateButton, PageHeader, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedNoteLists } from "@/lib/cache/notes";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { createBlankNoteAction } from "./actions";
import { NoteList } from "./note-list";

async function NotesBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ needsReview, allNotes }, tz, domains] = await Promise.all([
		getCachedNoteLists(),
		getCachedAppTimezone(),
		getCachedDomains(false),
	]);

	return (
		<div>
			<PageHeader
				title="Notes"
				measure={[
					{ count: allNotes.length, label: allNotes.length === 1 ? "note" : "notes" },
					// Only when there is something to review — a `0 need review`
					// in the accent would spend the one orange on nothing.
					...(needsReview.length > 0
						? [{ count: needsReview.length, label: "need review", attention: true }]
						: []),
				]}
				action={
					<form action={createBlankNoteAction}>
						<HeaderCreateButton label="New note" type="submit" />
					</form>
				}
			/>

			<NoteList
				needsReview={needsReview}
				allNotes={allNotes}
				tz={tz}
				domains={domains.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
			/>
		</div>
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

// The data streams in behind the page's own boundary, so the route keeps no
// loading.tsx and its static parts come out of the prerendered shell (#21).
export default function NotesPage() {
	return (
		<Suspense fallback={<NotesFallback />}>
			<NotesBody />
		</Suspense>
	);
}
