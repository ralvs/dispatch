"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setPinAction } from "@/app/(authed)/notes/actions";
import { EmptyState, ListRow, rowTitle, SectionHead } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
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
		<ListRow
			trailing={
				<button
					type="button"
					aria-label={pinned ? "Unpin note" : "Pin note"}
					aria-pressed={pinned}
					onClick={onTogglePin}
					className={`shrink-0 font-mono text-meta active:opacity-70 ${pinned ? "text-accent" : "text-ink-4 hover:text-ink"}`}
				>
					<Icon icon={Star} size="sm" fill={pinned ? "currentColor" : "none"} />
				</button>
			}
		>
			<Link href={`/notes/${note.id}`} className="block min-w-0 hover:text-accent-ink">
				<span className={rowTitle()}>{displayTitle(note)}</span>
				<span className="mt-0.5 block font-mono text-meta text-ink-4">
					{formatInstant(note.created_at, tz)}
					{note.needs_review ? " · needs review" : ""}
					{note.tags.length > 0 ? ` · ${note.tags.join(", ")}` : ""}
				</span>
			</Link>
		</ListRow>
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
	/** Takes the row, not just its id, so the caller can derive the desired pin state. */
	onTogglePin: (note: NoteListRow) => void;
	empty?: string;
}) {
	if (notes.length === 0 && !empty) return null;
	return (
		<section className="mt-6 first:mt-0" aria-label={label}>
			<SectionHead title={label} aside={notes.length > 0 ? String(notes.length) : undefined} />
			{notes.length === 0 ? (
				<EmptyState>{empty}</EmptyState>
			) : (
				<ul>
					{notes.map((n) => (
						<NoteLinkRow key={n.id} note={n} tz={tz} onTogglePin={() => onTogglePin(n)} />
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

	// The desired state comes from the row on screen — the same comparison the
	// optimistic reducer makes — so the write is a setter, not a flip, and a
	// stale second surface can't undo this one (docs/adr/0037).
	function toggle(note: NoteListRow, inReview: boolean) {
		const nextPinned = note.pinned_at === null;
		startTransition(async () => {
			if (inReview) dispatchReview(note.id);
			else dispatchNotes(note.id);
			await runAction(
				() => setPinAction({ id: note.id, pinned: nextPinned }),
				"Couldn't update pin.",
			);
		});
	}

	return (
		<>
			<Section label="Needs review" notes={review} tz={tz} onTogglePin={(n) => toggle(n, true)} />
			<Section label="Pinned" notes={pinned} tz={tz} onTogglePin={(n) => toggle(n, false)} />
			<Section
				label="All notes"
				notes={unpinned}
				tz={tz}
				onTogglePin={(n) => toggle(n, false)}
				empty="Nothing here yet. Capture something."
			/>
		</>
	);
}
