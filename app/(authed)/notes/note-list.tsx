"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createBlankNoteAction, setPinAction } from "@/app/(authed)/notes/actions";
import { ColorDot } from "@/components/color-dot";
import {
	HeaderCreateButton,
	ListRow,
	ListSection,
	PageHeader,
	rowTitle,
	type ScopeOption,
	ScopeSelect,
	UNFILED,
} from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { formatInstant } from "@/lib/dates";
import { displayTitle } from "@/lib/note-display";
import type { NoteListRow } from "@/lib/services/notes";
import { type NoteLists, useRunIntent, useView, viewKey } from "@/lib/store";

const NO_LISTS: NoteLists = { needsReview: [], all: [] };

function NoteLinkRow({
	note,
	tz,
	domainColor,
	onTogglePin,
}: {
	note: NoteListRow;
	tz: string;
	/** Palette slug of the note's domain, or null when it is unfiled. */
	domainColor: string | null;
	onTogglePin: () => void;
}) {
	const pinned = note.pinned_at !== null;
	return (
		<ListRow
			// `hold` keeps the 9px slot on an unfiled note so a mixed list keeps
			// one left edge (DESIGN.md, Invisible Slot Rule).
			leading={<ColorDot color={domainColor} hold />}
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
	domainColors,
	onTogglePin,
	empty,
}: {
	label: string;
	notes: NoteListRow[];
	tz: string;
	domainColors: Map<string, string | null>;
	/** Takes the row, not just its id, so the caller can derive the desired pin state. */
	onTogglePin: (note: NoteListRow) => void;
	empty?: string;
}) {
	if (notes.length === 0 && !empty) return null;
	return (
		<ListSection
			title={label}
			count={notes.length > 0 ? notes.length : undefined}
			empty={notes.length === 0 ? empty : undefined}
		>
			{notes.length > 0 ? (
				<ul>
					{notes.map((n) => (
						<NoteLinkRow
							key={n.id}
							note={n}
							tz={tz}
							domainColor={n.domain_id === null ? null : (domainColors.get(n.domain_id) ?? null)}
							onTogglePin={() => onTogglePin(n)}
						/>
					))}
				</ul>
			) : undefined}
		</ListSection>
	);
}

/**
 * /notes from the entity store (#27): the header's counts and both lists. A
 * pin is an intent — the star and the section flip at once, the server's row
 * confirms it, a failure puts it back. Filing a flagged note in the editor
 * moves it out of the band here, and Today's count with it.
 */
export function NoteList({
	tz,
	domains,
}: {
	tz: string;
	domains: Array<ScopeOption & { color: string | null }>;
}) {
	const { needsReview: review, all: notes } = useView(viewKey.notes()) ?? NO_LISTS;
	const run = useRunIntent("note", { errorMessage: "Couldn't update pin." });
	// "" = every note, UNFILED = the notes with no domain. Client-side over the
	// already-loaded list, the same shape /tasks uses.
	const [domainFilter, setDomainFilter] = useState("");
	const domainColors = new Map(domains.map((d) => [d.id, d.color]));

	function inScope(note: NoteListRow): boolean {
		if (domainFilter === "") return true;
		if (domainFilter === UNFILED) return note.domain_id === null;
		return note.domain_id === domainFilter;
	}

	const scoped = notes.filter(inScope);
	const pinned = scoped.filter((n) => n.pinned_at !== null);
	const unpinned = scoped.filter((n) => n.pinned_at === null);

	// The desired state comes from the row on screen, so the write is a
	// setter, not a flip, and a stale second surface can't undo this one
	// (docs/adr/0037).
	function toggle(note: NoteListRow) {
		const nextPinned = note.pinned_at === null;
		run({ type: "pin", id: note.id, pinned: nextPinned }, () =>
			setPinAction({ id: note.id, pinned: nextPinned }),
		);
	}

	return (
		// A real element, not a fragment: `first:mt-0` on a ListSection is
		// `:first-child`, and against the page's div the header held that slot,
		// so the first group kept its 36px and sat lower than every other page's
		// (ADR-0046).
		<div>
			<PageHeader
				title="Notes"
				measure={[
					{ count: notes.length, label: notes.length === 1 ? "note" : "notes" },
					// Only when there is something to review — a `0 need review`
					// in the accent would spend the one orange on nothing.
					...(review.length > 0
						? [{ count: review.length, label: "need review", attention: true }]
						: []),
				]}
				action={
					<form action={createBlankNoteAction}>
						<HeaderCreateButton label="New note" type="submit" />
					</form>
				}
			/>
			<div className="mb-4 flex items-center">
				<ScopeSelect
					value={domainFilter}
					onChange={setDomainFilter}
					label="Filter notes by domain"
					allLabel="All domains"
					unfiledLabel="No domain"
					options={domains}
				/>
			</div>
			<Section
				label="Needs review"
				notes={review.filter(inScope)}
				tz={tz}
				domainColors={domainColors}
				onTogglePin={toggle}
			/>
			<Section
				label="Pinned"
				notes={pinned}
				tz={tz}
				domainColors={domainColors}
				onTogglePin={toggle}
			/>
			<Section
				label="All notes"
				notes={unpinned}
				tz={tz}
				domainColors={domainColors}
				onTogglePin={toggle}
				empty={
					domainFilter === "" ? "Nothing here yet. Capture something." : "No notes in this domain."
				}
			/>
		</div>
	);
}
