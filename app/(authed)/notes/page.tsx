import { requireOwnerPage } from "@/lib/auth";
import { listNotes } from "@/lib/services/notes";
import { NoteForm } from "./note-form";
import { NoteRowItem } from "./note-row";

export default async function NotesPage() {
	const { sb } = await requireOwnerPage();
	const [needsReview, allNotes] = await Promise.all([
		listNotes(sb, { needsReview: true }),
		listNotes(sb),
	]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Notes</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Loose thoughts</h1>
			</header>

			<section className="mt-6">
				<NoteForm />
			</section>

			{needsReview.length > 0 && (
				<section className="mt-6" aria-label="Needs review">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Needs review
					</h2>
					<ul className="mt-2">
						{needsReview.map((n) => (
							<NoteRowItem key={n.id} note={n} />
						))}
					</ul>
				</section>
			)}

			<section className="mt-6" aria-label="All notes">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">All notes</h2>
				{allNotes.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						Nothing here yet. Capture something.
					</p>
				) : (
					<ul className="mt-2">
						{allNotes.map((n) => (
							<NoteRowItem key={n.id} note={n} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
