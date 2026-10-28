// The note kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Client-safe — server-action
// references only.

import { type Write, write } from "@/lib/store/write";
import {
	deleteNoteAction,
	removeAttachmentAction,
	resolveNeedsReviewAction,
	saveNoteAction,
	setNoteDomainAction,
	setPinAction,
} from "./actions";

export const noteWrites = {
	/** A setter, not a flip: `pinned` is the state the row on screen asks for (docs/adr/0037). */
	pin: (id: string, pinned: boolean): Write<"note"> =>
		write(
			"note",
			{ type: "pin", id, pinned },
			() => setPinAction({ id, pinned }),
			"Couldn't update pin.",
		),
	/** The autosave: no toast, the editor's own "Saved" says so. */
	save: (id: string, title: string | null, body: string): Write<"note"> =>
		write(
			"note",
			{ type: "save", id, title, body },
			() => saveNoteAction(id, { title, body }),
			"Couldn't save note.",
			null,
		),
	/** `domainId` is the select's value: "" unfiles the note. */
	file: (id: string, domainId: string): Write<"note"> =>
		write(
			"note",
			{ type: "file", id, domainId: domainId === "" ? null : domainId },
			() => setNoteDomainAction(id, domainId),
			"Couldn't file this note.",
		),
	resolve: (id: string): Write<"note"> =>
		write(
			"note",
			{ type: "resolve", id, flagged: true },
			() => resolveNeedsReviewAction(id),
			"Couldn't resolve review flag.",
		),
	remove: (id: string, flagged: boolean): Write<"note"> =>
		write(
			"note",
			{ type: "delete", id, flagged },
			() => deleteNoteAction(id),
			"Couldn't delete note.",
		),
	/** The note row carries its attachments (#27): the server's row confirms a touch. */
	removeAttachment: (noteId: string, storagePath: string): Write<"note"> =>
		write(
			"note",
			{ type: "touch", id: noteId },
			() => removeAttachmentAction(noteId, storagePath),
			"Couldn't remove the file.",
		),
};
