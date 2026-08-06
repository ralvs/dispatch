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
			<header className="hairline-strong flex items-end justify-between pb-4">
				<div>
					<p className="label">Notes</p>
					<h1 className="mt-1 font-serif text-3xl text-ink">Loose thoughts</h1>
				</div>
				<form action={createBlankNoteAction}>
					<button
						type="submit"
						className="rounded-control border border-line-strong px-3 py-2 label hover:border-accent hover:text-ink active:translate-y-px"
					>
						+ New note
					</button>
				</form>
			</header>

			<NoteList needsReview={needsReview} allNotes={allNotes} tz={tz} />
		</div>
	);
}
