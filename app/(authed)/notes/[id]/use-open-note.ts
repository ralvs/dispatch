"use client";

import { useEffect, useState } from "react";
import type { NoteListRow } from "@/lib/services/notes";
import { useView, viewKey } from "@/lib/store";

/**
 * The note this page opened, from the store (docs/adr/0079): its view is a
 * list of one, seeded by the page. A delete leaves the view at once; the last
 * row the store held stays on screen until the router has left the page.
 * Undefined: the note is gone.
 */
export function useOpenNote(noteId: string): NoteListRow | undefined {
	const stored = useView(viewKey.note(noteId))?.[0];
	const [last, setLast] = useState(stored);
	if (stored !== undefined && stored !== last) setLast(stored);
	// Next keeps a left page mounted but hidden, and hiding runs effect
	// cleanups: forget the held row here, so going Back to a deleted note shows
	// it gone rather than held.
	useEffect(() => () => setLast(undefined), []);
	return stored ?? last;
}
