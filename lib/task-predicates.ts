// Pure, timezone-agnostic task predicates (ADR-0002: the caller always
// supplies todayIso via todayInTz — these never call `new Date()`).
//
// Extracted from inline derivations that used to live separately in
// app/(authed)/tasks/task-row.tsx and app/(authed)/today/page.tsx, where the
// boundary logic could silently drift out of sync.

import type { TaskRow } from "@/lib/schemas/task";

/** A task is overdue if it's still open and its due date has passed. */
export function isOverdue(task: Pick<TaskRow, "status" | "due_date">, todayIso: string): boolean {
	return task.status !== "done" && task.due_date !== null && task.due_date < todayIso;
}

/** A task is due today if it's still open and its due date is exactly today. */
export function isDueToday(task: Pick<TaskRow, "status" | "due_date">, todayIso: string): boolean {
	return task.status !== "done" && task.due_date === todayIso;
}

/**
 * A task is quiet when it has no due date and its project is not active.
 *
 * Quiet tasks are held back from Today and the default /tasks views: an
 * undated task inside a paused, done or archived project is not work you are
 * carrying right now. Two escapes, both deliberate — a due date always wins
 * (naming a day is the promotion gesture), and a task with no project at all
 * is never quiet.
 *
 * Pure like its neighbours: the caller supplies the set of non-active project
 * ids (lib/services/quiet.ts) rather than this file reaching for the database.
 */
export function isQuiet(
	task: Pick<TaskRow, "due_date" | "project_id">,
	quietProjectIds: ReadonlySet<string>,
): boolean {
	if (task.due_date !== null) return false;
	if (task.project_id === null) return false;
	return quietProjectIds.has(task.project_id);
}

/** A task is starred for "today's top 3" if it's pinned to today's date. */
export function isTop3Today(task: Pick<TaskRow, "top3_for_date">, todayIso: string): boolean {
	return task.top3_for_date === todayIso;
}

/**
 * How many tasks the day's shortlist holds. Lives here rather than in each
 * surface so Today and the Tasks page can never disagree about how many slots
 * are open — the same reason the predicates above were extracted.
 */
export const TOP3_SLOTS = 3;
