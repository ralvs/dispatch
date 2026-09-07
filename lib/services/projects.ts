import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import {
	type CreateProjectSchema,
	PROJECT_SELECT,
	type ProjectRow,
	type ProjectStatusSchema,
	type UpdateProjectSchema,
} from "@/lib/schemas/project";
import { unwrap } from "@/lib/services/errors";
import {
	EMPTY_TASK_COUNTS,
	type ProjectTaskCounts,
	taskProgress,
} from "@/lib/services/projects-shared";
import { listTasks, type TaskRow } from "@/lib/services/tasks";

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

// ─── Task rollup ────────────────────────────────────────────────────────
//
// A project is a loose bucket that tags tasks (shape plan §02), so its
// progress is its tasks' progress. Milestones used to drive this; §08 Phase A
// retired them here and Phase B dropped the table (docs/adr/0056).

export { EMPTY_TASK_COUNTS, type ProjectTaskCounts, taskProgress };

/**
 * done/open task counts for every project, in one query.
 *
 * Nothing is excluded. A quiet task is quiet only elsewhere — on Today and in
 * the default /tasks views. The project's own page exists to show the project
 * whole, so its counts have to include every task tagged to it.
 */
export async function countTasksByProject(
	sb: SupabaseClient,
): Promise<Record<string, ProjectTaskCounts>> {
	const data = unwrap(
		await sb.from("tasks").select("project_id, status").not("project_id", "is", null),
	) as Array<{ project_id: string | null; status: string }> | null;

	const out: Record<string, ProjectTaskCounts> = {};
	for (const row of data ?? []) {
		if (row.project_id === null) continue;
		out[row.project_id] ??= { done: 0, open: 0 };
		const counts = out[row.project_id];
		if (row.status === "done") counts.done += 1;
		else counts.open += 1;
	}
	return out;
}

/**
 * A project's own tasks. Open first (the list surfaces show open only — plan
 * O5), each band in the same order /tasks uses.
 */
export async function listTasksForProject(
	sb: SupabaseClient,
	projectId: string,
	filters: { status?: "open" | "done" } = {},
): Promise<TaskRow[]> {
	// Nothing excluded, for the same reason countTasksByProject excludes
	// nothing: the section's own list has to agree with the row's counts.
	return listTasks(sb, { projectId, ...filters });
}
