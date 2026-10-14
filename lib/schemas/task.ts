import { z } from "zod";
import type { Selected } from "@/lib/database";
import { formDecoder } from "@/lib/form-decode";
import { isRecurrenceRule } from "@/lib/recurrence";

// A stored recurrence rule: one of the seven literals, or the custom weekly
// form `weekly:tu,sa` (shape plan §06 / P7). Validated through
// lib/recurrence.ts rather than re-listed here, so the schema and the parser
// cannot drift on what a valid rule is.
const RecurrenceRuleSchema = z.string().refine(isRecurrenceRule, {
	message: "Pick how it repeats.",
});

import { WallClockTimeSchema } from "@/lib/schemas/time";

/** Longest task title any write path accepts. */
export const TASK_TITLE_MAX = 500;
/** Longest task notes any write path accepts. */
export const TASK_NOTES_MAX = 5000;

export const TaskStatusSchema = z.enum(["open", "done"]);
export const TaskSourceSchema = z.enum(["manual", "voice", "email", "observation", "import"]);

// ─── FormData-facing schema (lib/actions/tasks.ts) ────────────
//
// FormData only ever produces strings, so empty/unset fields arrive as ""
// rather than being omitted — every optional field needs `.or(z.literal(""))`
// and priority needs z.coerce. Shares its leaves with the capture-side schema —
// RECURRENCE_PATTERNS, WallClockTimeSchema — rather than redeclaring them, so
// the two paths cannot drift on what a valid time or cadence is.
/** The priority a task gets when nothing states one: low. */
export const DEFAULT_TASK_PRIORITY = 3;

export const CreateTaskFormSchema = z
	.object({
		title: z
			.string({ error: "Give the task a title." })
			.trim()
			.min(1, "Give the task a title.")
			.max(TASK_TITLE_MAX),
		notes: z.string().trim().max(TASK_NOTES_MAX).optional(),
		due_date: z.iso.date().optional().or(z.literal("")),
		due_time: WallClockTimeSchema.optional().or(z.literal("")),
		priority: z.coerce.number().int().min(1).max(3).default(DEFAULT_TASK_PRIORITY),
		// Required, unlike every other optional here. The form's own `required`
		// is HTML5 constraint validation, which a disabled control skips and a
		// non-browser caller never runs at all — so on its own it is a hint,
		// not the rule. A task may still BE unfiled (capture routes there when
		// it cannot tell, docs/adr/0027); this form is simply not a way to make
		// one, and that has to be true where the write happens.
		domain_id: z.uuid({ error: "Pick a domain." }),
		// The project tag, settable at last (shape plan §06). The service has
		// always accepted it; only the form was missing, which left capture's
		// guess the sole writer and no way to correct it.
		project_id: z.uuid().optional().or(z.literal("")),
		recurrence_rule: RecurrenceRuleSchema.optional().or(z.literal("")),
	})
	// A time with no date to put it on is meaningless (matches the DB check
	// constraint — see the migration that added it). Report it as a form
	// validation error rather than letting it reach the service, where it
	// would otherwise be silently coerced away.
	.refine((v) => !(v.due_time && !v.due_date), {
		message: "A time needs a date.",
		path: ["due_time"],
	});

/** The task form's one decode, shared by the optimistic row and the server (docs/adr/0087). */
export const taskForm = formDecoder(CreateTaskFormSchema);

/** The task form's columns as the service writes them: a blank optional field is null. */
export type TaskFormFields = {
	title: string;
	notes: string | null;
	due_date: string | null;
	due_time: string | null;
	priority: number;
	domain_id: string;
	project_id: string | null;
	recurrence_rule: string | null;
};

export function taskFormFields(parsed: z.output<typeof CreateTaskFormSchema>): TaskFormFields {
	return {
		title: parsed.title,
		notes: parsed.notes || null,
		due_date: parsed.due_date || null,
		due_time: parsed.due_time || null,
		priority: parsed.priority,
		// Guaranteed by CreateTaskFormSchema — this form cannot make an unfiled task.
		domain_id: parsed.domain_id,
		// Null, not undefined: clearing the select is how a task leaves a
		// project, and the field is always present on the form.
		project_id: parsed.project_id || null,
		recurrence_rule: parsed.recurrence_rule || null,
	};
}

// ─── Row shape actually returned by the tasks service ──────────────────
//
// The select is the source of truth: TaskRow is inferred from it against the
// generated database types, so a column added here flows into the row type.
export const TASK_SELECT =
	"id, title, notes, status, due_date, due_time, priority, project_id, domain_id, recurrence_rule, recurrence_day, series_id, top3_for_date, source, created_at, completed_at, domain:stewardship_domains(id, name, color), project:projects(id, name)" as const;
/**
 * A task row as the store and the UI hold it. The embeds are optional because
 * rows built client-side (optimistic writes) may not carry them; every row the
 * service returns does.
 */
export type TaskRow = PartialBy<Selected<"tasks", typeof TASK_SELECT>, "domain" | "project">;

/**
 * Columns completeTask and skipTask need — no joined domain/project on the
 * hot path. The next cycle comes from the rule, the due date and the intended
 * day; the text is for the snapshot's mentions. The database copies the rest.
 */
export const TASK_HOT_SELECT =
	"id, title, notes, recurrence_rule, recurrence_day, due_date" as const;
export type TaskHotRow = Selected<"tasks", typeof TASK_HOT_SELECT>;

/** `T` with the keys `K` made optional. */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
