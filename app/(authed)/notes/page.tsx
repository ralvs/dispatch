import { HeaderCreateButton, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedNoteLists } from "@/lib/cache/notes";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { createBlankNoteAction } from "./actions";
import { NoteList } from "./note-list";

export default async function NotesPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [{ needsReview, allNotes }, tz] = await Promise.all([
		getCachedNoteLists(),
		getCachedAppTimezone(),
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

			<NoteList needsReview={needsReview} allNotes={allNotes} tz={tz} />
		</div>
	);
}
