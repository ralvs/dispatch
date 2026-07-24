"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { getEvent } from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";
import { createManualLink } from "@/lib/services/note-links";
import { createNote } from "@/lib/services/notes";
import { clearSkipsToday, recordQuoteSkip } from "@/lib/services/resurfacing";
import { todayForRequest } from "@/lib/services/settings";

/** "Next →" on the Resurfaced card: skip today's pick, advance the rotation. */
export async function skipResurfacedQuoteAction(quoteId: string) {
	const { sb } = await requireOwnerPage();
	await recordQuoteSkip(sb, z.uuid().parse(quoteId), await todayForRequest(sb));
	afterMutation("today.only");
}

/** "Reset" on the Resurfaced card: forget today's skips. */
export async function resetResurfacedAction() {
	const { sb } = await requireOwnerPage();
	await clearSkipsToday(sb, await todayForRequest(sb));
	afterMutation("today.only");
}

/** Quiet "note" glyph on an unlinked event row: creates a meeting note pre-titled
 * from the event and manually links it, then hands off to the note editor. */
export async function createMeetingNoteForEventAction(eventId: string) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(eventId);
	const event = await getEvent(sb, id);
	if (!event) throw new ServiceError("Event not found", null);

	const note = await createNote(sb, { body: "", title: event.title, source_type: "meeting_note" });
	await createManualLink(sb, { note_id: note.id, target_type: "event", target_id: id });

	afterMutation("notes.write", { id: note.id });
	afterMutation("today.only");
	redirect(`/notes/${note.id}`);
}
