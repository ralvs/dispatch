import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import {
	type CreateMilestoneSchema,
	MILESTONE_SELECT,
	type MilestoneRow,
} from "@/lib/schemas/milestone";
import {
	type CreateProjectSchema,
	PROJECT_SELECT,
	type ProjectRow,
	type ProjectStatusSchema,
	type UpdateProjectSchema,
} from "@/lib/schemas/project";
import { unwrap } from "@/lib/services/errors";

// ─── Projects ───────────────────────────────────────────────────────────

export type { ProjectRow };

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export async function listProjects(
	sb: SupabaseClient,
	filters: { status?: z.infer<typeof ProjectStatusSchema> } = {},
): Promise<ProjectRow[]> {
	let q = sb.from("projects").select(PROJECT_SELECT).order("name", { ascending: true });
	if (filters.status) q = q.eq("status", filters.status);
	const data = unwrap(await q);
	return (data ?? []) as unknown as ProjectRow[];
}

export async function getProject(sb: SupabaseClient, id: string): Promise<ProjectRow | null> {
	const data = unwrap(await sb.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle());
	return (data as unknown as ProjectRow | null) ?? null;
}

export async function createProject(
	sb: SupabaseClient,
	input: CreateProjectInput,
): Promise<ProjectRow> {
	const data = unwrap(await sb.from("projects").insert(input).select(PROJECT_SELECT).single());
	return data as unknown as ProjectRow;
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

export type { MilestoneRow };

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

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
	return (data ?? []) as unknown as MilestoneRow[];
}

/** Milestones for many projects in one query, grouped by project id. */
export async function listMilestonesForProjects(
	sb: SupabaseClient,
	projectIds: string[],
): Promise<Record<string, MilestoneRow[]>> {
	if (projectIds.length === 0) return {};
	const data = unwrap(
		await sb
			.from("milestones")
			.select(MILESTONE_SELECT)
			.in("project_id", projectIds)
			.order("position", { ascending: true })
			.order("created_at", { ascending: true }),
	);
	const grouped: Record<string, MilestoneRow[]> = {};
	for (const row of (data ?? []) as unknown as MilestoneRow[]) {
		if (!grouped[row.project_id]) grouped[row.project_id] = [];
		grouped[row.project_id].push(row);
	}
	return grouped;
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
	return data as unknown as MilestoneRow;
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
export { milestoneProgress } from "@/lib/services/projects-shared";
