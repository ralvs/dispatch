import { z } from "zod";
import { HexColorSchema } from "@/lib/schemas/color";

export const ProjectStatusSchema = z.enum(["active", "paused", "done", "archived"]);
export const ProjectTypeSchema = z.enum(["client", "internal", "content"]);
export const EngagementTypeSchema = z.enum(["project", "retainer"]);
export type EngagementType = z.infer<typeof EngagementTypeSchema>;
// kind: 'project' (finite, has an outcome) vs 'area' (ongoing context like
// Home, Garage, Health). Orthogonal to engagement_type — a 'project' kind
// can still be a retainer, and areas are always 'project' engagement_type
// since they have no client.
export const ProjectKindSchema = z.enum(["project", "area"]);
export type ProjectKind = z.infer<typeof ProjectKindSchema>;

export const ProjectSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	domain_id: z.string().uuid().nullable().optional(),
	status: ProjectStatusSchema,
	type: ProjectTypeSchema.nullable().optional(),
	client_id: z.string().uuid().nullable().optional(),
	quoted_hours: z.number().nullable().optional(),
	hours_logged: z.number(),
	start_date: z.string().date().nullable().optional(),
	target_date: z.string().date().nullable().optional(),
	color: HexColorSchema.nullable().optional(),
	engagement_type: EngagementTypeSchema.default("project"),
	kind: ProjectKindSchema.default("project"),
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
	type: ProjectTypeSchema.nullable().optional(),
	client_id: z.string().uuid().nullable().optional(),
	quoted_hours: z.number().nullable().optional(),
	start_date: z.string().date().nullable().optional(),
	target_date: z.string().date().nullable().optional(),
	color: HexColorSchema.nullable().optional(),
	engagement_type: EngagementTypeSchema.optional(),
	kind: ProjectKindSchema.optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
	status: ProjectStatusSchema.optional(),
	hours_logged: z.number().optional(),
});

// Milestone schemas (MilestoneSchema, CreateMilestoneSchema,
// UpdateMilestoneSchema, MilestoneStatusSchema) live in ./milestone —
// pre-existing in this repo, re-exported via ./index.

// ─── Row shape actually returned by the projects service ───────────────
//
// Mirrors exactly the columns PROJECT_SELECT reads
// (lib/services/projects.ts). PROJECT_SELECT is derived from this schema's
// keys. No joins for this entity.
export const ProjectRowSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	domain_id: z.string().uuid().nullable(),
	status: ProjectStatusSchema,
	type: ProjectTypeSchema.nullable(),
	client_id: z.string().uuid().nullable(),
	quoted_hours: z.number().nullable(),
	hours_logged: z.number(),
	start_date: z.string().nullable(),
	target_date: z.string().nullable(),
	completed_at: z.string().nullable(),
	color: z.string().nullable(),
	engagement_type: EngagementTypeSchema,
	kind: ProjectKindSchema,
	created_at: z.string(),
	updated_at: z.string(),
});
export type ProjectRow = z.infer<typeof ProjectRowSchema>;

export const PROJECT_SELECT = Object.keys(ProjectRowSchema.shape).join(", ");
