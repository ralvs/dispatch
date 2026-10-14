import { z } from "zod";
import type { Selected } from "@/lib/database";
import { formDecoder } from "@/lib/form-decode";
import { ColorSlugSchema } from "@/lib/schemas/color";
import type { PartialBy } from "@/lib/schemas/task";

export const ProjectStatusSchema = z.enum(["active", "paused", "done", "archived"]);
// `type` (client/internal/content) and `kind` (project/area) are gone: both
// were display-only badges, and the project's domain already says what they
// were reaching for. No replacement vocabulary.

// All optional fields are .nullable() so the client can explicitly clear
// them via PATCH (or send null on create to mean "leave empty"). Without
// nullable, sending null would fail Zod validation and force the action
// to branch per-field on "omit vs include" — a footgun.
export const CreateProjectSchema = z.object({
	name: z.string({ error: "Give the project a name." }).min(1, "Give the project a name."),
	description: z.string().nullable().optional(),
	// Required, never null: a project always has a domain, and its tasks
	// inherit it (docs/adr/0019).
	domain_id: z.string({ error: "Pick a domain." }).uuid("Pick a domain."),
	start_date: z.string().date().nullable().optional(),
	target_date: z.string().date().nullable().optional(),
	color: ColorSlugSchema.nullable().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
	status: ProjectStatusSchema.optional(),
});

/** The project forms' one decode each, shared by the optimistic half and the server (docs/adr/0087). */
export const createProjectForm = formDecoder(CreateProjectSchema);
export type CreateProjectInput = z.output<typeof CreateProjectSchema>;
export const updateProjectForm = formDecoder(UpdateProjectSchema);
export type UpdateProjectInput = z.output<typeof UpdateProjectSchema>;

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
// The select is the source of truth: ProjectRow is inferred from it against
// the generated database types (cf. TASK_SELECT).
export const PROJECT_SELECT =
	"id, name, description, domain_id, status, start_date, target_date, completed_at, color, created_at, updated_at, domain:stewardship_domains(id, name, color)" as const;
/** The domain embed is optional: an optimistic row built client-side may lack it. */
export type ProjectRow = PartialBy<Selected<"projects", typeof PROJECT_SELECT>, "domain">;
