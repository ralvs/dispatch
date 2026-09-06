/**
 * A project's progress, counted from its own tasks.
 *
 * Client-safe: pure math shared between the server-only projects service and
 * client components.
 *
 * This replaced `milestoneProgress` in the shape plan's P5. A percentage that
 * only moved when you ticked an invented checklist item measured the checklist,
 * not the work. Counting the project's own tasks measures something that exists
 * for other reasons and cannot be gamed by forgetting to tick.
 */
export type ProjectTaskCounts = { done: number; open: number };

export const EMPTY_TASK_COUNTS: ProjectTaskCounts = { done: 0, open: 0 };

/** Completion fraction (0..1). 0 for a project with no tasks at all. */
export function taskProgress(counts: ProjectTaskCounts): number {
	const total = counts.done + counts.open;
	if (total === 0) return 0;
	return counts.done / total;
}
