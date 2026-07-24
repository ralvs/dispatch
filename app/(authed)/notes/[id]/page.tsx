import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { getNote, listNoteTitles } from "@/lib/services/notes";
import { NoteEditor } from "./note-editor";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();

	const { sb } = await requireOwnerPage();
	const [note, noteTitles] = await Promise.all([getNote(sb, parsedId.data), listNoteTitles(sb)]);
	if (!note) notFound();

	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/notes"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Notes
				</Link>
			</nav>
			<NoteEditor note={note} noteTitles={noteTitles} />
		</div>
	);
}
