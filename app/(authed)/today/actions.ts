"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDaySchedule } from "@/lib/cache/briefing";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatInstant, parseDateIso, todayInTz } from "@/lib/dates";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import type { DaySchedulePayload } from "@/lib/services/briefing";
import { getEvent } from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";
import { createManualLink, listNoteIdsForTargets } from "@/lib/services/note-links";
import { createNote } from "@/lib/services/notes";
import { clearSkipsToday, recordQuoteSkip } from "@/lib/services/resurfacing";
import { todayForRequest } from "@/lib/services/settings";

/**
 * Load one day's tape + bands without re-running the ~13-query briefing chrome.
 * Used by Today day-nav so chevrons stay on the client and never trip loading.tsx.
 */
export async function loadDayScheduleAction(rawDate: string): Promise<DaySchedulePayload> {
	const { sb } = await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	const dateIso = parseDateIso(rawDate);
	if (!dateIso) throw new ServiceError("Invalid date", null);

	// Cached by date; task writes revalidateTag(day-schedule).
	const schedule = await getCachedDaySchedule(tz, dateIso);
	const nowUtcIso = new Date().toISOString();
	const isToday = dateIso === todayIso;

	const eventIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "event")
		.map((item) => item.event.id);
	const scheduledTaskIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "task")
		.map((item) => item.task.id);
	const taskIds = [
		...new Set([
			...scheduledTaskIds,
			...schedule.top3.map((task) => task.id),
			...schedule.open.map((task) => task.id),
		]),
	];

	const [eventNoteIds, taskNoteIds] = await Promise.all([
		listNoteIdsForTargets(sb, "event", eventIds).then((map) => Object.fromEntries(map)),
		listNoteIdsForTargets(sb, "task", taskIds).then((map) => Object.fromEntries(map)),
	]);

	return {
		schedule,
		dateIso,
		nowUtcIso,
		nowLabel: isToday ? formatInstant(nowUtcIso, tz, "HH:mm") : null,
		eventNoteIds,
		taskNoteIds,
	};
}

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
