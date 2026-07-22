import { z } from "zod";

// Calendar events — iCloud CalDAV (ADR-0006), Google pull (ADR-0018), or created here.
// Mirrors the SQL table; source strings match the DB CHECK constraint.

export const CalendarEventSourceSchema = z.enum(["caldav", "google", "created_here"]);
export type CalendarEventSource = z.infer<typeof CalendarEventSourceSchema>;

// ─── Row shape actually returned by the calendar service ────────────────
//
// Mirrors exactly the columns EVENT_SELECT reads (lib/services/calendar.ts).
// EVENT_SELECT is derived from this schema's keys. No joins for this entity.
export const CalendarEventRowSchema = z.object({
	id: z.string().uuid(),
	title: z.string(),
	description: z.string().nullable(),
	start_at: z.string(),
	end_at: z.string(),
	all_day: z.boolean(),
	location: z.string().nullable(),
	calendar_name: z.string().nullable(),
	attendees: z.array(z.string()),
	source: CalendarEventSourceSchema,
});
export type CalendarEventRow = z.infer<typeof CalendarEventRowSchema>;

export const EVENT_SELECT = Object.keys(CalendarEventRowSchema.shape).join(", ");
