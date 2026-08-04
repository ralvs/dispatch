import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCaldavClient } from "@/lib/caldav/client";
import { instantFromLocal, todayInTz } from "@/lib/dates";
import { isCaldavConfigured } from "@/lib/env";
import type { CaptureAction, CreateEventAction } from "@/lib/schemas/capture";
import { createEventHere } from "@/lib/services/calendar";
import type { ActionResult } from "@/lib/services/capture";
import { type RoutingLists, taskInputFromAction } from "@/lib/services/capture/resolve";
import { createEntry } from "@/lib/services/journal";
import { createNeedsReviewNote, createNote } from "@/lib/services/notes";
import { recordNotification } from "@/lib/services/notifications";
import { createQuote } from "@/lib/services/quotes";
import { createTask } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// Turns parsed capture actions into service calls, one at a time, each fully
// isolated: a failure of one action (a service error, or the parser's explicit
// needs_review verb) degrades ONLY that action to a needs_review note and the
// loop continues — one bad action of three never loses the other two. Nothing
// here throws into the capture path; the raw is already durable regardless.
// ─────────────────────────────────────────────────────────────────────────

export type Provenance = {
	capturedId: string;
	// The verbatim transcript — the body used when an action degrades, so
	// content is preserved as-spoken with no model in the loop.
	transcript: string;
	// App timezone (iron rule #1) — used to resolve "today" for date-only
	// fields (e.g. journal entry_date) instead of raw `new Date()` math.
	tz: string;
	// Routing candidates for create_task's domain/project names (docs/adr/0019
	// D2) — fetched once in process(), never re-queried per action.
	routing: RoutingLists;
};

async function degrade(
	sb: SupabaseClient,
	prov: Provenance,
	action: string,
	reason: string,
	proposedKind?: string,
): Promise<ActionResult> {
	let noteId = "";
	try {
		const note = await createNeedsReviewNote(sb, {
			body: prov.transcript,
			origin_capture_id: prov.capturedId,
			reason,
			proposed_kind: proposedKind,
		});
		noteId = note.id;
	} catch {
		// Even the safety-net note failed. The raw capture is still in
		// captured_data, so nothing is lost — surface an empty noteId.
	}
	return { action, ok: false, reason, noteId };
}

/**
 * The one capture action that leaves the building: it writes a VEVENT to the
 * iCloud calendar named by ICLOUD_CALENDAR_NAME before the local mirror row
 * exists (docs/adr/0006's single push target, docs/adr/0023).
 *
 * Throws on every failure — no CalDAV credentials, no such calendar, a
 * network error, or an end that precedes its start — so runOne's catch turns
 * it into a needs_review note holding the verbatim transcript. A capture that
 * cannot reach iCloud must still be recoverable by hand.
 */
async function runCreateEvent(
	sb: SupabaseClient,
	action: CreateEventAction,
	prov: Provenance,
): Promise<ActionResult> {
	if (!isCaldavConfigured()) {
		throw new Error("iCloud CalDAV is not configured; event not created");
	}

	// Wall-clock in the app timezone → UTC instants (iron rule #1). The model
	// answers in the timezone the prompt gave it; nothing here does date math.
	const startUtc = instantFromLocal(action.start_date, action.start_time, prov.tz);
	const endUtc = instantFromLocal(action.end_date ?? action.start_date, action.end_time, prov.tz);
	if (Date.parse(endUtc) <= Date.parse(startUtc)) {
		throw new Error(`Event ends at or before it starts (${action.start_time}–${action.end_time})`);
	}

	const event = await createEventHere(sb, await createCaldavClient(), {
		title: action.title,
		startUtc,
		endUtc,
		description: action.description,
		location: action.location,
	});

	// An external write, so it owes a ledger row (iron rule #6) — best-effort,
	// per ADR-0015: the event is already on the calendar and losing the row
	// must not undo it.
	try {
		await recordNotification(sb, {
			type: "capture.event",
			title: "Event added to calendar",
			body: `${event.title} — ${action.start_date} ${action.start_time}`,
			source_ref: event.id,
		});
	} catch {
		// Ledger only. The VEVENT and its mirror row both exist.
	}

	return { action: "create_event", ok: true, entity: { table: "calendar_events", id: event.id } };
}

async function runOne(
	sb: SupabaseClient,
	action: CaptureAction,
	prov: Provenance,
): Promise<ActionResult> {
	try {
		switch (action.action) {
			case "create_task": {
				const task = await createTask(sb, taskInputFromAction(action, prov.routing), {
					graphFail: "swallow",
				});
				return { action: "create_task", ok: true, entity: { table: "tasks", id: task.id } };
			}
			case "create_event":
				return await runCreateEvent(sb, action, prov);
			case "create_note": {
				const note = await createNote(
					sb,
					{
						body: action.body,
						source_type: action.source_type,
						tags: action.tags,
						origin_capture_id: prov.capturedId,
					},
					{ graphFail: "swallow" },
				);
				return { action: "create_note", ok: true, entity: { table: "notes", id: note.id } };
			}
			case "create_quote": {
				const q = await createQuote(sb, {
					text: action.text,
					source_type: action.source_type ?? null,
					source_author: action.source_author ?? null,
					tags: action.tags,
					added_via: "manual",
				});
				return { action: "create_quote", ok: true, entity: { table: "quotes", id: q.id } };
			}
			case "create_journal_entry": {
				const e = await createEntry(sb, {
					transcription_text: action.body,
					entry_date: action.entry_date ?? todayInTz(prov.tz),
					source: "typed",
					tags: action.tags,
				});
				return {
					action: "create_journal_entry",
					ok: true,
					entity: { table: "journal_entries", id: e.id },
				};
			}
			case "needs_review":
				return degrade(sb, prov, "needs_review", action.reason, action.proposed_kind);
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		return degrade(sb, prov, action.action, reason);
	}
}

export async function runActions(
	sb: SupabaseClient,
	actions: CaptureAction[],
	prov: Provenance,
): Promise<ActionResult[]> {
	const results: ActionResult[] = [];
	for (const action of actions) {
		results.push(await runOne(sb, action, prov));
	}
	return results;
}
