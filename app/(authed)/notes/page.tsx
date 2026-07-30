import { requireOwnerPage } from "@/lib/auth";
import { listNotes } from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";
import { createBlankNoteAction } from "./actions";
import { NoteList } from "./note-list";

export default async function NotesPage() {
	const { sb } = await requireOwnerPage();
	const [needsReview, allNotes, tz] = await Promise.all([
		listNotes(sb, { needsReview: true }),
		listNotes(sb, { needsReview: false }),
		getAppTimezone(sb),
	]);

	return (
		<div>
			<header className="hairline-strong flex items-end justify-between pb-4">
				<div>
					<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Notes</p>
					<h1 className="mt-1 font-serif text-3xl text-ink">Loose thoughts</h1>
				</div>
				<form action={createBlankNoteAction}>
					<button
						type="submit"
						className="rounded-md border border-line-strong px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink active:opacity-70"
					>
						+ New note
					</button>
				</form>
			</header>

			<NoteList needsReview={needsReview} allNotes={allNotes} tz={tz} />
		</div>
	);
}
