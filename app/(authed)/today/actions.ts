"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatInstant, parseDateIso, todayInTz } from "@/lib/dates";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { type DaySchedulePayload, getDaySchedule } from "@/lib/services/briefing";
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

	// Uncached, and on the RLS client — deliberately the same read briefing-body
	// does for a navigated day, because the two must not disagree. The cached
	// variant lives up to 180s (cacheLife expire) and the caldav/reminders crons
	// write calendar_events without busting the day-schedule tag, so a cached
	// read can be older than what SSR/SoftRefresh already painted. Now that
	// day-nav revalidates the day on screen in the background, serving that
	// older copy would silently erase a freshly-synced event. Two indexed
	// queries (lib/services/briefing.ts loadDayScheduleInputs) — the client-side
	// day cache is what makes repeat visits free, not this.
	const schedule = await getDaySchedule(sb, tz, dateIso);
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
