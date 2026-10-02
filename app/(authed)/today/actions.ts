"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { parseDateIso, todayInTz } from "@/lib/dates";
import { afterMutation } from "@/lib/invalidate";
import { getEvent } from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";
import { createManualLink } from "@/lib/services/note-links";
import { createNote } from "@/lib/services/notes";
import { clearSkipsToday, recordQuoteSkip } from "@/lib/services/resurfacing";
import { todayForRequest } from "@/lib/services/settings";
import { loadDaySchedulePayload, loadResurfaced, type ResurfacedState } from "@/lib/services/today";
import { viewKey } from "@/lib/store/keys";
import { stampRead } from "@/lib/store/server";
import type { Snapshot } from "@/lib/store/types";
import { readToday } from "./today-snapshots";

/**
 * Load one day's tape + bands without re-running the ~13-query Today digest,
 * as a snapshot for the entity store (#26). Used by Today day-nav so chevrons
 * stay on the client and never trip loading.tsx.
 */
export async function loadDayScheduleAction(rawDate: string): Promise<Snapshot> {
	const { sb } = await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	const dateIso = parseDateIso(rawDate);
	if (!dateIso) throw new ServiceError("Invalid date", null);

	// Uncached, and on the RLS client — deliberately the same read today-body
	// does for a navigated day, because the two must not disagree. The cached
	// variant lives up to 180s (cacheLife expire) and the caldav/reminders crons
	// write calendar_events without busting the day-schedule tag, so a cached
	// read can be older than what SSR/SoftRefresh already painted. Now that
	// day-nav revalidates the day on screen in the background, serving that
	// older copy would silently erase a freshly-synced event. Two indexed
	// queries (lib/services/today.ts loadDayScheduleInputs) — the entity store
	// holding each day is what makes repeat visits free, not this.
	const { data, readAt } = await stampRead(() =>
		loadDaySchedulePayload(sb, tz, dateIso, { todayIso }),
	);
	return {
		readAt,
		todayIso,
		tz,
		views: [{ key: viewKey.day(dateIso), type: "day", data }],
	};
}

/**
 * The 5-minute pull (#4): everything Today shows, as the snapshots the page
 * itself seeds — the bands of the day on screen, the counters and the alerts
 * beside them, the masthead badge, the routines card, the project rings — and
 * `todayIso`, so the client can tell the day rolled over. This is how a cron's write (caldav, reminders,
 * sweep, capture) reaches an open tab: those write from outside the app, and
 * no page render follows them.
 */
export async function pullTodayAction(shownDate?: string): Promise<Snapshot[]> {
	const { sb } = await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	// The day on screen gets its bands; everything else on Today is today's.
	const shown = (shownDate !== undefined && parseDateIso(shownDate)) || todayIso;
	const { snapshot, digestSnapshot } = await readToday(sb, tz, todayIso, shown, Date.now());
	return [snapshot, digestSnapshot];
}

/**
 * "Next →" on the Resurfaced card: skip today's pick, advance the rotation.
 * Answers with the card's new state (#30).
 */
export async function skipResurfacedQuoteAction(
	quoteId: string,
): Promise<ActionResult<ResurfacedState>> {
	const { sb } = await requireOwnerPage();
	const todayIso = await todayForRequest(sb);
	await recordQuoteSkip(sb, z.uuid().parse(quoteId), todayIso);
	afterMutation("today.only");
	return { ok: true, data: await loadResurfaced(sb, todayIso) };
}

/** "Reset" on the Resurfaced card: forget today's skips. Answers with the card's new state. */
export async function resetResurfacedAction(): Promise<ActionResult<ResurfacedState>> {
	const { sb } = await requireOwnerPage();
	const todayIso = await todayForRequest(sb);
	await clearSkipsToday(sb, todayIso);
	afterMutation("today.only");
	return { ok: true, data: await loadResurfaced(sb, todayIso) };
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

	afterMutation("notes.write");
	afterMutation("today.only");
	redirect(`/notes/${note.id}`);
}
