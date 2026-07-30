"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { togglePinAction } from "@/app/(authed)/notes/actions";
import { runAction } from "@/lib/client/toast";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import type { NoteListRow } from "@/lib/services/notes";

function NoteLinkRow({
	note,
	tz,
	onTogglePin,
}: {
	note: NoteListRow;
	tz: string;
	onTogglePin: () => void;
}) {
	const pinned = note.pinned_at !== null;
	return (
		<li className="flex items-start border-b border-line">
			<Link href={`/notes/${note.id}`} className="block flex-1 py-3 hover:bg-surface">
				<span className="block truncate font-serif text-base text-ink">{displayTitle(note)}</span>
				<span className="mt-0.5 block font-mono text-meta text-ink-4">
					{formatInstant(note.created_at, tz)}
					{note.needs_review ? " · needs review" : ""}
					{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
				</span>
			</Link>
			<button
				type="button"
				aria-label={pinned ? "Unpin note" : "Pin note"}
				aria-pressed={pinned}
				onClick={onTogglePin}
				className={`shrink-0 px-2 py-3 font-mono text-meta active:opacity-70 ${pinned ? "text-accent" : "text-ink-4 hover:text-ink"}`}
			>
				{pinned ? "★" : "☆"}
			</button>
		</li>
	);
}

function Section({
	label,
	notes,
	tz,
	onTogglePin,
	empty,
}: {
	label: string;
	notes: NoteListRow[];
	tz: string;
	onTogglePin: (id: string) => void;
	empty?: string;
}) {
	if (notes.length === 0 && !empty) return null;
	return (
		<section className="mt-6" aria-label={label}>
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">{label}</h2>
			{notes.length === 0 ? (
				<p className="py-8 text-center font-serif italic text-ink-3">{empty}</p>
			) : (
				<ul className="mt-2">
					{notes.map((n) => (
						<NoteLinkRow key={n.id} note={n} tz={tz} onTogglePin={() => onTogglePin(n.id)} />
					))}
				</ul>
			)}
		</section>
	);
}

function flipPin(note: NoteListRow): NoteListRow {
	return {
		...note,
		pinned_at: note.pinned_at === null ? new Date().toISOString() : null,
	};
}

/**
 * Owns useOptimistic for pin so the star and section membership flip before
 * the notes list RSC revalidation.
 */
export function NoteList({
	needsReview,
	allNotes,
	tz,
}: {
	needsReview: NoteListRow[];
	allNotes: NoteListRow[];
	tz: string;
}) {
	const [, startTransition] = useTransition();
	const [review, dispatchReview] = useOptimistic(needsReview, (current, id: string) =>
		current.map((n) => (n.id === id ? flipPin(n) : n)),
	);
	const [notes, dispatchNotes] = useOptimistic(allNotes, (current, id: string) =>
		current.map((n) => (n.id === id ? flipPin(n) : n)),
	);

	const pinned = notes.filter((n) => n.pinned_at !== null);
	const unpinned = notes.filter((n) => n.pinned_at === null);

	function toggle(id: string, inReview: boolean) {
		startTransition(async () => {
			if (inReview) dispatchReview(id);
			else dispatchNotes(id);
			await runAction(() => togglePinAction(id), "Couldn't update pin.");
		});
	}

	return (
		<>
			<Section label="Needs review" notes={review} tz={tz} onTogglePin={(id) => toggle(id, true)} />
			<Section label="Pinned" notes={pinned} tz={tz} onTogglePin={(id) => toggle(id, false)} />
			<Section
				label="All notes"
				notes={unpinned}
				tz={tz}
				onTogglePin={(id) => toggle(id, false)}
				empty="Nothing here yet. Capture something."
			/>
		</>
	);
}
