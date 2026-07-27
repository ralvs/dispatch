import { z } from "zod";
import { RECURRENCE_PATTERNS } from "@/lib/recurrence";
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
	// null means unfiled — the /inbox queue (docs/adr/0025).
	domain_id: z.string().uuid().nullable(),
	parent_task_id: z.string().uuid().nullable().optional(),
	recurrence_rule: z.enum(RECURRENCE_PATTERNS).nullable().optional(),
	reminder_offsets: z.array(z.number()).default([]),
	source: TaskSourceSchema,
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

export const CreateTaskSchema = z.object({
	title: z.string().min(1),
	notes: nullableString(),
	due_date: nullableDate(),
	due_time: nullableString(),
	priority: z.number().int().min(1).max(4).default(4),
	project_id: z.string().uuid().nullable().optional(),
	// domain_id is optional at the schema level so frictionless capture works
	// (no domain picked → the task stays unfiled). When project_id is set,
	// the server overwrites domain_id with the project's domain. When both
	// are passed explicitly and mismatched, the server returns 400.
	domain_id: z.string().uuid().nullable().optional(),
	parent_task_id: z.string().uuid().nullable().optional(),
	recurrence_rule: z.enum(RECURRENCE_PATTERNS).nullable().optional(),
	reminder_offsets: z.array(z.number()).optional(),
	source: TaskSourceSchema.default("manual"),
	top3_for_date: nullableDate(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
	status: TaskStatusSchema.optional(),
});

// ─── FormData-facing schema (app/(authed)/tasks/actions.ts) ────────────
//
// FormData only ever produces strings, so empty/unset fields arrive as ""
// rather than being omitted — every optional field needs `.or(z.literal(""))`
// and priority needs z.coerce. Shares its leaves with the capture-side schema —
// RECURRENCE_PATTERNS, WallClockTimeSchema — rather than redeclaring them, so
// the two paths cannot drift on what a valid time or cadence is.
export const CreateTaskFormSchema = z.object({
	title: z.string().trim().min(1).max(500),
	notes: z.string().trim().max(5000).optional(),
	due_date: z.iso.date().optional().or(z.literal("")),
	due_time: WallClockTimeSchema.optional().or(z.literal("")),
	priority: z.coerce.number().int().min(1).max(4).default(4),
	domain_id: z.uuid().optional().or(z.literal("")),
	recurrence_rule: z.enum(RECURRENCE_PATTERNS).optional().or(z.literal("")),
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
