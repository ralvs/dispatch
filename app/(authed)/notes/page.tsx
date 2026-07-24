import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import { listNotes, type NoteListRow } from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";
import { createBlankNoteAction } from "./actions";

function NoteLinkRow({ note, tz }: { note: NoteListRow; tz: string }) {
	return (
		<li className="border-b border-line">
			<Link href={`/notes/${note.id}`} className="block py-3 hover:bg-surface">
				<span className="block truncate font-serif text-base text-ink">{displayTitle(note)}</span>
				<span className="mt-0.5 block font-mono text-meta text-ink-4">
					{formatInstant(note.created_at, tz)}
					{note.needs_review ? " · needs review" : ""}
					{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
				</span>
			</Link>
		</li>
	);
}

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
						className="rounded-md border border-line-strong px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink"
					>
						+ New note
					</button>
				</form>
			</header>

			{needsReview.length > 0 && (
				<section className="mt-6" aria-label="Needs review">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Needs review
					</h2>
					<ul className="mt-2">
						{needsReview.map((n) => (
							<NoteLinkRow key={n.id} note={n} tz={tz} />
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
							<NoteLinkRow key={n.id} note={n} tz={tz} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
