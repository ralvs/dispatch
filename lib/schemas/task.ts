import { z } from "zod";
import { isRecurrenceRule } from "@/lib/recurrence";

// A stored recurrence rule: one of the seven literals, or the custom weekly
// form `weekly:tu,sa` (shape plan §06 / P7). Validated through
// lib/recurrence.ts rather than re-listed here, so the schema and the parser
// cannot drift on what a valid rule is.
const RecurrenceRuleSchema = z.string().refine(isRecurrenceRule, {
	message: "not a recurrence rule",
});

import { WallClockTimeSchema } from "@/lib/schemas/time";

export const TaskStatusSchema = z.enum(["open", "done"]);
export const TaskSourceSchema = z.enum(["manual", "voice", "email", "observation", "import"]);

// Fields that can be explicitly cleared in updates need .nullable() —
// .optional() alone only accepts undefined (omit the field). Sending null
// clears it server-side.
const nullableString = () => z.string().nullable().optional();
const nullableDate = () => z.string().date().nullable().optional();

// The full/write-side model — a superset of what TASK_SELECT reads today.
// Not wired to a query yet (reminder_offsets/reminders_sent have no
// executor); treat additions here as a wire-in path, not a feature.
export const TaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1),
	notes: nullableString(),
	status: TaskStatusSchema,
	due_date: nullableDate(),
	due_time: nullableString(),
	priority: z.number().int().min(1).max(4),
	project_id: z.string().uuid().nullable().optional(),
	// null means unfiled — the /inbox queue (docs/adr/0027).
	domain_id: z.string().uuid().nullable(),
	recurrence_rule: RecurrenceRuleSchema.nullable().optional(),
	reminder_offsets: z.array(z.number()).default([]),
	source: TaskSourceSchema,
	// A want: an intent with no time (shape plan §03). Not a status and not a
	// second entity — the clock is simply switched off.
	someday: z.boolean().default(false),
	top3_for_date: nullableDate(),
	created_at: z.string().datetime({ offset: true }),
	completed_at: z.string().datetime({ offset: true }).nullable().optional(),
	updated_at: z.string().datetime({ offset: true }),
	// Optional joins — present when API returns linked entity metadata.
	domain: z
		.object({
			id: z.string().uuid(),
			name: z.string(),
			color: z.string().nullable(),
		})
		.nullable()
		.optional(),
	project: z
		.object({
			id: z.string().uuid(),
			name: z.string(),
			color: z.string().nullable().optional(),
		})
		.nullable()
		.optional(),
});

// ─── FormData-facing schema (app/(authed)/tasks/actions.ts) ────────────
//
// FormData only ever produces strings, so empty/unset fields arrive as ""
// rather than being omitted — every optional field needs `.or(z.literal(""))`
// and priority needs z.coerce. Shares its leaves with the capture-side schema —
// RECURRENCE_PATTERNS, WallClockTimeSchema — rather than redeclaring them, so
// the two paths cannot drift on what a valid time or cadence is.
export const CreateTaskFormSchema = z
	.object({
		title: z.string().trim().min(1).max(500),
		notes: z.string().trim().max(5000).optional(),
		due_date: z.iso.date().optional().or(z.literal("")),
		due_time: WallClockTimeSchema.optional().or(z.literal("")),
		priority: z.coerce.number().int().min(1).max(4).default(4),
		domain_id: z.uuid().optional().or(z.literal("")),
		// The project tag, settable at last (shape plan §06). The service has
		// always accepted it; only the form was missing, which left capture's
		// guess the sole writer and no way to correct it.
		project_id: z.uuid().optional().or(z.literal("")),
		recurrence_rule: RecurrenceRuleSchema.optional().or(z.literal("")),
		// An unchecked checkbox posts nothing at all, so absence is false. The
		// literal is what a checked one posts through the hidden input the form
		// uses, which keeps the value legible in a FormData dump.
		someday: z.literal("on").optional().or(z.literal("")),
	})
	// A time with no date to put it on is meaningless (matches the DB check
	// constraint — see the migration that added it). Report it as a form
	// validation error rather than letting it reach the service, where it
	// would otherwise be silently coerced away.
	.refine((v) => !(v.due_time && !v.due_date), {
		message: "due_time requires due_date",
		path: ["due_time"],
	})
	// A want has the clock switched off, so it cannot also be scheduled. Same
	// invariant as the DB check constraint; reported here as a form error
	// rather than reaching the service and being silently coerced.
	.refine((v) => !(v.someday === "on" && v.due_date), {
		message: "a want cannot have a due date",
		path: ["someday"],
	});

// ─── Row shape actually returned by the tasks service ──────────────────
//
// Mirrors exactly the columns TASK_SELECT reads (lib/services/tasks.ts).
// TASK_SELECT is derived from this schema's keys, so a field added here
// automatically flows into the query — keep the two joins (domain/project)
// listed last, since they map to PostgREST embedded-resource syntax rather
// than a plain column name.
export const TaskRowSchema = z.object({
	id: z.string().uuid(),
	title: z.string(),
	notes: z.string().nullable(),
	status: TaskStatusSchema,
	due_date: z.string().nullable(),
	due_time: z.string().nullable(),
	priority: z.number(),
	project_id: z.string().uuid().nullable(),
	domain_id: z.string().uuid().nullable(),
	recurrence_rule: z.string().nullable(),
	someday: z.boolean(),
	top3_for_date: z.string().nullable(),
	source: z.string(),
	created_at: z.string(),
	completed_at: z.string().nullable(),
	domain: z
		.object({ id: z.string().uuid(), name: z.string(), color: z.string().nullable() })
		.nullable()
		.optional(),
	project: z.object({ id: z.string().uuid(), name: z.string() }).nullable().optional(),
});
export type TaskRow = z.infer<typeof TaskRowSchema>;

// Plain columns select as-is; joins need PostgREST's embedded-resource
// syntax. Keep this map in sync with any relation added to TaskRowSchema.
const TASK_JOIN_SELECTS: Record<string, string> = {
	domain: "domain:stewardship_domains(id, name, color)",
	project: "project:projects(id, name)",
};

export const TASK_SELECT = Object.keys(TaskRowSchema.shape)
	.map((key) => TASK_JOIN_SELECTS[key] ?? key)
	.join(", ");
