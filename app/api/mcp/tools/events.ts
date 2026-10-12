import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { type CaldavConnection, createCaldavClient } from "@/lib/caldav/client";
import { whyNotEditable } from "@/lib/calendar-edit";
import { calendarDaysBetween, formatInstant, instantFromLocal, isAfter } from "@/lib/dates";
import { allDayDateSpan } from "@/lib/day-schedule";
import { env, isCaldavConfigured } from "@/lib/env";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import {
	type CalendarEventRow,
	type CalendarEventWithKind,
	createEventHere,
	deleteEvent,
	getEventWithKind,
	listEventsBetween,
	type UpdateEventInput,
	updateEvent,
} from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";
import { type Json, recordNotification } from "@/lib/services/notifications";
import { getAppTimezone } from "@/lib/services/settings";
import { registerTextTool, ToolError } from "../contract";

// The owner's calendar, as an assistant sees it (docs/adr/0079): the work
// calendar from the Mac bridge (ADR-0018) and every iCloud calendar (ADR-0006),
// in one table. Writes go to the write calendar only, and only to single
// events there (docs/adr/0082). Times cross this boundary as wall clock in the
// app timezone; lib/dates.ts converts them (iron rule #1).

const DateSchema = z.iso.date();
const LocalTimeSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use YYYY-MM-DDTHH:mm, local time.")
	.describe("Local wall clock in the app timezone, YYYY-MM-DDTHH:mm.");
const TITLE_MAX = 500;
const LOCATION_MAX = 2000;
const DESCRIPTION_MAX = 20000;
/** Two months: more than the ±21 days the table holds, small enough to read. */
const LIST_SPAN_MAX_DAYS = 62;

/** Service refusals the model can act on; anything else stays an error. */
const REFUSALS = new Set(["NOT_FOUND", "NOT_EDITABLE", "CONFLICT"]);

/** Start and end as the owner reads them: dates for all-day, wall clock otherwise. */
function localSpan(row: CalendarEventRow, tz: string): { start: string; end: string } {
	if (row.all_day) {
		const { first, last } = allDayDateSpan(row, tz);
		return { start: first, end: last };
	}
	const format = "yyyy-MM-dd'T'HH:mm";
	return {
		start: formatInstant(row.start_at, tz, format),
		end: formatInstant(row.end_at, tz, format),
	};
}

function toListItem(row: CalendarEventWithKind, tz: string) {
	return {
		id: row.id,
		title: row.title,
		...localSpan(row, tz),
		all_day: row.all_day,
		location: row.location,
		calendar: row.calendar_name,
		source: row.source,
		editable: whyNotEditable(row, env().ICLOUD_CALENDAR_NAME) === null,
	};
}

function toDetail(row: CalendarEventWithKind, tz: string) {
	const reason = whyNotEditable(row, env().ICLOUD_CALENDAR_NAME);
	return {
		...toListItem(row, tz),
		description: row.description,
		attendees: row.attendees,
		...(reason ? { not_editable_because: reason } : {}),
	};
}

/** A wall-clock input as a UTC instant, or a ToolError the model can fix. */
function instantOf(local: string, tz: string): string {
	const [date, time] = local.split("T") as [string, string];
	try {
		return instantFromLocal(date, time, tz);
	} catch {
		throw new ToolError(`${local} is not a real time in ${tz}.`);
	}
}

async function connect(): Promise<CaldavConnection> {
	if (!isCaldavConfigured()) throw new ToolError("iCloud is not set up in Dispatch.");
	return createCaldavClient();
}

/** Run a calendar write; a refusal reaches the model as the reason, word for word. */
async function refusalsAsToolErrors<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (err) {
		if (err instanceof ServiceError && err.code && REFUSALS.has(err.code)) {
			throw new ToolError(err.message);
		}
		throw err;
	}
}

/** The event behind an edit, refused here before any call to iCloud. */
async function mustGetEditable(sb: SupabaseClient, id: string): Promise<CalendarEventWithKind> {
	const row = await getEventWithKind(sb, id);
	if (!row) throw new ToolError("No event with that id.");
	const reason = whyNotEditable(row, env().ICLOUD_CALENDAR_NAME);
	if (reason) throw new ToolError(reason);
	return row;
}

/** The row's fields, as JSON the ledger stores. */
function snapshot(row: CalendarEventRow): { [key: string]: Json } {
	return { ...row };
}

export function registerEventTools(server: McpServer, sb: SupabaseClient): void {
	registerTextTool(
		server,
		"list_events",
		{
			title: "List events",
			description:
				"The owner's calendar events from start_date to end_date (inclusive, YYYY-MM-DD in the app timezone), soonest first. Times are local wall clock in that timezone; an all-day event gives dates. Dispatch holds only events within about 21 days of today, and work events (source google) can be up to 15 minutes old. editable is true only for a single event on the write calendar.",
			inputSchema: z.object({
				start_date: DateSchema.describe("First day, YYYY-MM-DD."),
				end_date: DateSchema.describe("Last day, YYYY-MM-DD."),
				calendar: z.string().min(1).optional().describe("Only this calendar, by name."),
			}),
			annotations: { readOnlyHint: true },
		},
		async ({ start_date, end_date, calendar }) => {
			if (end_date < start_date) throw new ToolError("end_date is before start_date.");
			if (calendarDaysBetween(start_date, end_date) >= LIST_SPAN_MAX_DAYS) {
				throw new ToolError(`Ask for at most ${LIST_SPAN_MAX_DAYS} days at a time.`);
			}
			const tz = await getAppTimezone(sb);
			const rows = await listEventsBetween(sb, start_date, end_date, tz, calendar);
			return { timezone: tz, events: rows.map((row) => toListItem(row, tz)) };
		},
	);

	registerTextTool(
		server,
		"get_event",
		{
			title: "Get an event",
			description:
				"One event in full, by its id from list_events, with description and attendees. A non-editable event says why.",
			inputSchema: z.object({ id: z.uuid().describe("The event's id.") }),
			annotations: { readOnlyHint: true },
		},
		async ({ id }) => {
			const row = await getEventWithKind(sb, id);
			if (!row) throw new ToolError("No event with that id.");
			return toDetail(row, await getAppTimezone(sb));
		},
	);

	registerTextTool(
		server,
		"create_event",
		{
			title: "Create an event",
			description: `Add a timed event to the write calendar ("${env().ICLOUD_CALENDAR_NAME ?? "not set up"}") in iCloud. start and end are local wall clock in the app timezone.`,
			inputSchema: z.object({
				title: z.string().trim().min(1).max(TITLE_MAX),
				start: LocalTimeSchema,
				end: LocalTimeSchema,
				description: z.string().max(DESCRIPTION_MAX).optional(),
				location: z.string().max(LOCATION_MAX).optional(),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ title, start, end, description, location }) => {
			const tz = await getAppTimezone(sb);
			const startUtc = instantOf(start, tz);
			const endUtc = instantOf(end, tz);
			if (!isAfter(endUtc, startUtc)) {
				throw new ToolError("end must be after start.");
			}
			const conn = await connect();
			const created = await refusalsAsToolErrors(() =>
				createEventHere(sb, conn, { title, startUtc, endUtc, description, location }),
			);
			// Iron rule #6: the assistant's write lands in the ledger. Undo deletes it.
			await recordNotification(sb, {
				type: "mcp.event.created",
				title: "Assistant created an event",
				body: created.title,
				source_ref: created.id,
				undo_payload: { table: "calendar_events", id: created.id },
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpEvents);
			return toDetail({ ...created, recurring: false }, tz);
		},
	);

	registerTextTool(
		server,
		"update_event",
		{
			title: "Update an event",
			description:
				"Edit a single event on the write calendar, by id. start and end are local wall clock in the app timezone; moving only start keeps the length. null clears description or location. A work event, an event on another calendar, a repeating event, or one changed in iCloud since the last sync is refused with the reason.",
			inputSchema: z.object({
				id: z.uuid().describe("The event's id."),
				title: z.string().trim().min(1).max(TITLE_MAX).optional(),
				start: LocalTimeSchema.optional(),
				end: LocalTimeSchema.optional(),
				description: z.string().max(DESCRIPTION_MAX).nullable().optional(),
				location: z.string().max(LOCATION_MAX).nullable().optional(),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ id, title, start, end, description, location }) => {
			const tz = await getAppTimezone(sb);
			const patch: UpdateEventInput = {};
			if (title !== undefined) patch.title = title;
			if (start !== undefined) patch.startUtc = instantOf(start, tz);
			if (end !== undefined) patch.endUtc = instantOf(end, tz);
			if (description !== undefined) patch.description = description;
			if (location !== undefined) patch.location = location;
			if (Object.keys(patch).length === 0) {
				throw new ToolError("Nothing to change: send at least one field.");
			}

			const before = await mustGetEditable(sb, id);
			// The service refuses this too, after a read from iCloud; this answers first.
			if (patch.startUtc !== undefined || patch.endUtc !== undefined) {
				const startUtc = patch.startUtc ?? before.start_at;
				const endUtc = patch.endUtc ?? (patch.startUtc === undefined ? before.end_at : undefined);
				if (endUtc !== undefined && !isAfter(endUtc, startUtc)) {
					throw new ToolError("end must be after start.");
				}
			}
			const conn = await connect();
			const after = await refusalsAsToolErrors(() => updateEvent(sb, conn, id, patch));

			// The previous values are what the ledger's undo replays.
			const prev: { [key: string]: Json } = {};
			for (const key of ["title", "description", "location", "start_at", "end_at"] as const) {
				if (before[key] !== after[key]) prev[key] = before[key];
			}
			await recordNotification(sb, {
				type: "mcp.event.updated",
				title: "Assistant updated an event",
				body: after.title,
				source_ref: id,
				undo_payload: { table: "calendar_events", id, prev },
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpEvents);
			return toDetail({ ...after, recurring: before.recurring }, tz);
		},
	);

	registerTextTool(
		server,
		"delete_event",
		{
			title: "Delete an event",
			description:
				"Delete a single event on the write calendar, by id, in iCloud and in Dispatch. Refused, with the reason, for the same events update_event refuses.",
			inputSchema: z.object({ id: z.uuid().describe("The event's id.") }),
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
		},
		async ({ id }) => {
			await mustGetEditable(sb, id);
			const conn = await connect();
			const deleted = await refusalsAsToolErrors(() => deleteEvent(sb, conn, id));
			// The whole event, so undo can create it again.
			await recordNotification(sb, {
				type: "mcp.event.deleted",
				title: "Assistant deleted an event",
				body: deleted.title,
				source_ref: id,
				undo_payload: { table: "calendar_events", id, event: snapshot(deleted) },
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpEvents);
			return { deleted: true, id, title: deleted.title };
		},
	);
}
