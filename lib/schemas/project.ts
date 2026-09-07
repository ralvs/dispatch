import { z } from "zod";
import { ColorSlugSchema } from "@/lib/schemas/color";

export const ProjectStatusSchema = z.enum(["active", "paused", "done", "archived"]);
// `type` (client/internal/content) and `kind` (project/area) are gone: both
// were display-only badges, and the project's domain already says what they
// were reaching for. No replacement vocabulary.

export const ProjectSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	domain_id: z.string().uuid().nullable().optional(),
	status: ProjectStatusSchema,
	start_date: z.string().date().nullable().optional(),
	target_date: z.string().date().nullable().optional(),
	color: ColorSlugSchema.nullable().optional(),
	completed_at: z.string().datetime({ offset: true }).nullable().optional(),
	created_at: z.string().datetime({ offset: true }),
	updated_at: z.string().datetime({ offset: true }),
});

// All optional fields are .nullable() so the client can explicitly clear
// them via PATCH (or send null on create to mean "leave empty"). Without
// nullable, sending null would fail Zod validation and force the action
// to branch per-field on "omit vs include" — a footgun.
export const CreateProjectSchema = z.object({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	domain_id: z.string().uuid().nullable().optional(),
	start_date: z.string().date().nullable().optional(),
	target_date: z.string().date().nullable().optional(),
	color: ColorSlugSchema.nullable().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
	status: ProjectStatusSchema.optional(),
});

// Retired here by the shape plan's P5 (§08): client_id, quoted_hours,
// hours_logged and engagement_type. Every one of them exists to prove what was
// delivered to a paying client — the job §01 argues Dispatch does not have,
// because Linear owns delivery history. Phase B has since dropped all four
// from Postgres (docs/adr/0056).
//
// Milestones went the same way. A percentage that only moved when you ticked
// an invented checklist item measured the checklist, not the work; progress is
// now the project's own tasks (decision D2, lib/services/projects-shared.ts).

// ─── Row shape actually returned by the projects service ───────────────
//
// Mirrors exactly the columns PROJECT_SELECT reads
// (lib/services/projects.ts). PROJECT_SELECT is derived from this schema's
// keys, so a field added here automatically flows into the query — keep the
// domain join listed last, since it maps to PostgREST embedded-resource
// syntax rather than a plain column name (cf. TaskRowSchema/TASK_SELECT).
export const ProjectRowSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	domain_id: z.string().uuid().nullable(),
	status: ProjectStatusSchema,
	start_date: z.string().nullable(),
	target_date: z.string().nullable(),
	completed_at: z.string().nullable(),
	color: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	domain: z
		.object({ id: z.string().uuid(), name: z.string(), color: z.string().nullable() })
		.nullable()
		.optional(),
});
export type ProjectRow = z.infer<typeof ProjectRowSchema>;

// Plain columns select as-is; the domain relation needs PostgREST's
// embedded-resource syntax. Keep this map in sync with any relation added
// to ProjectRowSchema.
const PROJECT_JOIN_SELECTS: Record<string, string> = {
	domain: "domain:stewardship_domains(id, name, color)",
};

export const PROJECT_SELECT = Object.keys(ProjectRowSchema.shape)
	.map((key) => PROJECT_JOIN_SELECTS[key] ?? key)
	.join(", ");
