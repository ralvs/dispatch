import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import type { MilestoneStatusSchema } from "@/lib/schemas/milestone";
import type {
	EngagementType,
	ProjectKind,
	ProjectStatusSchema,
	ProjectTypeSchema,
} from "@/lib/schemas/project";
import { unwrap } from "@/lib/services/errors";

// ─── Projects ───────────────────────────────────────────────────────────

const PROJECT_SELECT =
	"id, name, description, domain_id, status, type, client_id, quoted_hours, hours_logged, start_date, target_date, completed_at, color, engagement_type, kind, created_at, updated_at";

export type ProjectRow = {
	id: string;
	name: string;
	description: string | null;
	domain_id: string | null;
	status: z.infer<typeof ProjectStatusSchema>;
	type: z.infer<typeof ProjectTypeSchema> | null;
	client_id: string | null;
	quoted_hours: number | null;
	hours_logged: number;
	start_date: string | null;
	target_date: string | null;
	completed_at: string | null;
	color: string | null;
	engagement_type: EngagementType;
	kind: ProjectKind;
	created_at: string;
	updated_at: string;
};

export type CreateProjectInput = {
	name: string;
	description?: string | null;
	domain_id?: string | null;
	type?: z.infer<typeof ProjectTypeSchema> | null;
	client_id?: string | null;
	quoted_hours?: number | null;
	start_date?: string | null;
	target_date?: string | null;
	color?: string | null;
	engagement_type?: EngagementType;
	kind?: ProjectKind;
};

export type UpdateProjectInput = Partial<CreateProjectInput> & {
	status?: z.infer<typeof ProjectStatusSchema>;
	hours_logged?: number;
	completed_at?: string | null;
};

export async function listProjects(
	sb: SupabaseClient,
	filters: { status?: z.infer<typeof ProjectStatusSchema> } = {},
): Promise<ProjectRow[]> {
	let q = sb.from("projects").select(PROJECT_SELECT).order("name", { ascending: true });
	if (filters.status) q = q.eq("status", filters.status);
	const data = unwrap(await q);
	return (data ?? []) as ProjectRow[];
}

export async function getProject(sb: SupabaseClient, id: string): Promise<ProjectRow | null> {
	const data = unwrap(await sb.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle());
	return (data as ProjectRow | null) ?? null;
}

export async function createProject(
	sb: SupabaseClient,
	input: CreateProjectInput,
): Promise<ProjectRow> {
	const data = unwrap(await sb.from("projects").insert(input).select(PROJECT_SELECT).single());
	return data as ProjectRow;
}

export async function updateProject(
	sb: SupabaseClient,
	id: string,
	patch: UpdateProjectInput,
): Promise<void> {
	unwrap(await sb.from("projects").update(patch).eq("id", id));
}

/** Marks the project done and stamps completed_at (UTC now). */
export async function completeProject(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("projects").update({ status: "done", completed_at: nowUtc() }).eq("id", id));
}

/** Soft-removes the project from active views without deleting it. */
export async function archiveProject(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("projects").update({ status: "archived" }).eq("id", id));
}

// ─── Milestones ─────────────────────────────────────────────────────────

const MILESTONE_SELECT =
	"id, project_id, title, status, weight, position, completed_at, created_at";

export type MilestoneRow = {
	id: string;
	project_id: string;
	title: string;
	status: z.infer<typeof MilestoneStatusSchema>;
	weight: number;
	position: number;
	completed_at: string | null;
	created_at: string;
};

export type CreateMilestoneInput = {
	title: string;
	weight?: number;
	position?: number;
};

export async function listMilestones(
	sb: SupabaseClient,
	projectId: string,
): Promise<MilestoneRow[]> {
	const data = unwrap(
		await sb
			.from("milestones")
			.select(MILESTONE_SELECT)
			.eq("project_id", projectId)
			.order("position", { ascending: true })
			.order("created_at", { ascending: true }),
	);
	return (data ?? []) as MilestoneRow[];
}

export async function createMilestone(
	sb: SupabaseClient,
	projectId: string,
	input: CreateMilestoneInput,
): Promise<MilestoneRow> {
	const data = unwrap(
		await sb
			.from("milestones")
			.insert({ ...input, project_id: projectId })
			.select(MILESTONE_SELECT)
			.single(),
	);
	return data as MilestoneRow;
}

/** Flips a milestone open<->done, stamping/clearing completed_at to match. */
export async function toggleMilestone(
	sb: SupabaseClient,
	id: string,
	done: boolean,
): Promise<void> {
	unwrap(
		await sb
			.from("milestones")
			.update({ status: done ? "done" : "open", completed_at: done ? nowUtc() : null })
			.eq("id", id),
	);
}

export async function deleteMilestone(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("milestones").delete().eq("id", id));
}

/** Done weight / total weight, in [0, 1]. 0 for an empty milestone list. */
export function milestoneProgress(milestones: Pick<MilestoneRow, "status" | "weight">[]): number {
	const total = milestones.reduce((sum, m) => sum + m.weight, 0);
	if (total === 0) return 0;
	const done = milestones.filter((m) => m.status === "done").reduce((sum, m) => sum + m.weight, 0);
	return done / total;
}
