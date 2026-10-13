import { z } from "zod";
import type { Selected } from "@/lib/database";

// Calendar events — iCloud CalDAV (ADR-0006), Mac EventKit bridge for work
// Google calendars (ADR-0018, source='google'), or created here.
// Mirrors the SQL table; source strings match the DB CHECK constraint.

export const CalendarEventSourceSchema = z.enum(["caldav", "google", "created_here"]);
export type CalendarEventSource = z.infer<typeof CalendarEventSourceSchema>;

/** One event payload from the Mac EventKit bridge (POST /api/calendar/bridge). */
/** ISO-8601 instant (Z or offset); EventKit may omit fractional seconds. */
const IsoInstantSchema = z
	.string()
	.min(10)
	.max(40)
	.refine((s) => Number.isFinite(Date.parse(s)), { message: "Invalid ISO instant" });

export const BridgeEventSchema = z.object({
	uid: z.string().min(1).max(512),
	title: z.string().min(1).max(2000),
	start_at: IsoInstantSchema,
	end_at: IsoInstantSchema,
	all_day: z.boolean().default(false),
	location: z.string().max(2000).nullable().optional(),
	description: z.string().max(20000).nullable().optional(),
	calendar_name: z.string().min(1).max(500),
	/** Opaque change token (EventKit lastModified date ISO works). */
	etag: z.string().max(512).optional(),
});
export type BridgeEvent = z.infer<typeof BridgeEventSchema>;

export const BridgeSyncBodySchema = z.object({
	events: z.array(BridgeEventSchema).max(5000),
	window_start: IsoInstantSchema,
	window_end: IsoInstantSchema,
});
export type BridgeSyncBody = z.infer<typeof BridgeSyncBodySchema>;

// ─── Row shape actually returned by the calendar service ────────────────
//
// The columns the calendar service reads (lib/services/calendar.ts). The row
// type is inferred from this literal select. No joins for this entity.
export const EVENT_SELECT =
	"id, title, description, start_at, end_at, all_day, location, calendar_name, attendees, source" as const;
export type CalendarEventRow = Selected<"calendar_events", typeof EVENT_SELECT>;
