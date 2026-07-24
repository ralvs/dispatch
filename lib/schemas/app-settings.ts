import { z } from "zod";

// App-wide settings. Single row in the DB (boolean PK pinned to true),
// so this is effectively a singleton record. Future settings get
// added as new columns here + a corresponding field on the schemas.

// IANA timezone validation — just checks the rough shape ("Area/City"
// or single-token like "UTC"). The browser's Intl handles invalid
// values gracefully (falls back to UTC), and the settings UI will
// validate against `Intl.supportedValuesOf('timeZone')` client-side
// before submitting, so anything that gets here should be valid.
const TimezoneSchema = z
	.string()
	.min(1)
	.regex(/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/, "Must be an IANA timezone string.");

// Whole minutes before the due instant a reminder fires. 0 = at the due
// time itself. Capped at 2 days — beyond that isn't a "reminder" anymore.
const ReminderOffsetMinutesSchema = z.coerce.number().int().min(0).max(2880);

// Wall-clock HH:MM (or HH:MM:SS, matching how Postgres `time` round-trips).
const ReminderAnchorTimeSchema = z
	.string()
	.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be a wall-clock time (HH:MM).");

export const AppSettingsSchema = z.object({
	id: z.literal(true),
	timezone: TimezoneSchema,
	reminder_offset_minutes: ReminderOffsetMinutesSchema,
	reminder_anchor_time: ReminderAnchorTimeSchema,
	updated_at: z.string().datetime({ offset: true }),
});

export const UpdateAppSettingsSchema = z.object({
	timezone: TimezoneSchema.optional(),
	reminder_offset_minutes: ReminderOffsetMinutesSchema.optional(),
	reminder_anchor_time: ReminderAnchorTimeSchema.optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type UpdateAppSettings = z.infer<typeof UpdateAppSettingsSchema>;
