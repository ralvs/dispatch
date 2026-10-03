// The quiet-project rule, in one place (docs/adr/0058). Client-safe: the
// server's task reads, the neglect sweep, /tasks and the entity store all ask
// it, so none of them can drift on what "quiet" means.
//
// A project is quiet when it is not active — paused, done or archived. A task
// is quiet when it has no due date and its project is quiet. Two escapes, both
// deliberate: a due date always wins (naming a day is the promotion gesture),
// and a task with no project at all is never quiet.

import type { TaskRow } from "@/lib/schemas/task";

export function isQuietProject(project: { status: string }): boolean {
	return project.status !== "active";
}

/** The ids of the quiet projects among `projects`. */
export function quietProjectIdsOf(projects: readonly { id: string; status: string }[]): string[] {
	return projects.filter(isQuietProject).map((p) => p.id);
}

/**
 * Quiet tasks are held back from Today, the inbox and the default /tasks
 * views: an undated task inside a project you are not carrying is not work
 * you are carrying right now.
 */
export function isQuiet(
	task: Pick<TaskRow, "due_date" | "project_id">,
	quietProjectIds: ReadonlySet<string>,
): boolean {
	if (task.due_date !== null) return false;
	if (task.project_id === null) return false;
	return quietProjectIds.has(task.project_id);
}

/**
 * `isQuiet` as a PostgREST `or` filter that keeps every task that is not
 * quiet: the negation of "undated AND in a quiet project" — it has a date, or
 * has no project, or its project is not quiet. Null when nothing is quiet:
 * PostgREST rejects an empty `in.()`, and there is nothing to filter anyway.
 */
export function notQuietFilter(quietProjectIds: ReadonlySet<string>): string | null {
	if (quietProjectIds.size === 0) return null;
	return `due_date.not.is.null,project_id.is.null,project_id.not.in.(${[...quietProjectIds].join(",")})`;
}
