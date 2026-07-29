import { isRecurrencePattern, nextDueDate } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/schemas/task";

/** Intents the optimistic layer understands (v1). Edit waits for the server. */
export type TaskIntent =
	| { type: "complete"; id: string }
	| { type: "reopen"; id: string }
	| { type: "toggleTop3"; id: string }
	| { type: "delete"; id: string }
	| { type: "create"; task: TaskRow };

export type ApplyContext = {
	todayIso: string;
	/**
	 * Which day a ☆ toggle pins to. Defaults to todayIso. Today's day navigation
	 * passes the day on screen — the two part company there, and only for the
	 * star: a completed recurring task still rolls forward from the real today.
	 */
	top3DateIso?: string;
	/** ISO instant for completed_at; defaults to now when omitted. */
	nowIso?: string;
};

export type TaskLists = {
	open: TaskRow[];
	done: TaskRow[];
};

function mapId(tasks: TaskRow[], id: string, fn: (t: TaskRow) => TaskRow): TaskRow[] {
	return tasks.map((t) => (t.id === id ? fn(t) : t));
}

function withoutId(tasks: TaskRow[], id: string): TaskRow[] {
	return tasks.filter((t) => t.id !== id);
}

function findIn(tasks: TaskRow[], id: string): TaskRow | undefined {
	return tasks.find((t) => t.id === id);
}

/**
 * Project open+done lists for the Tasks page after an intent.
 * Pure — same recurrence roll math as completeTask (lib/recurrence.nextDueDate).
 */
export function applyTaskLists(lists: TaskLists, intent: TaskIntent, ctx: ApplyContext): TaskLists {
	const nowIso = ctx.nowIso ?? new Date().toISOString();

	switch (intent.type) {
		case "create": {
			return { open: [intent.task, ...lists.open], done: lists.done };
		}
		case "delete": {
			return {
				open: withoutId(lists.open, intent.id),
				done: withoutId(lists.done, intent.id),
			};
		}
		case "toggleTop3": {
			const target = ctx.top3DateIso ?? ctx.todayIso;
			const patch = (t: TaskRow): TaskRow => ({
				...t,
				top3_for_date: t.top3_for_date === target ? null : target,
			});
			return {
				open: mapId(lists.open, intent.id, patch),
				done: mapId(lists.done, intent.id, patch),
			};
		}
		case "reopen": {
			const task = findIn(lists.done, intent.id) ?? findIn(lists.open, intent.id);
			if (!task) return lists;
			const reopened: TaskRow = { ...task, status: "open", completed_at: null };
			return {
				open: [reopened, ...withoutId(lists.open, intent.id)],
				done: withoutId(lists.done, intent.id),
			};
		}
		case "complete": {
			const task = findIn(lists.open, intent.id) ?? findIn(lists.done, intent.id);
			if (!task) return lists;

			if (task.recurrence_rule && isRecurrencePattern(task.recurrence_rule)) {
				const due = nextDueDate({
					currentDue: task.due_date,
					rule: task.recurrence_rule,
					todayIso: ctx.todayIso,
				});
				const rolled: TaskRow = { ...task, due_date: due };
				return {
					open: mapId(lists.open, intent.id, () => rolled),
					done: withoutId(lists.done, intent.id),
				};
			}

			const completed: TaskRow = {
				...task,
				status: "done",
				completed_at: nowIso,
				top3_for_date: null,
			};
			return {
				open: withoutId(lists.open, intent.id),
				done: [completed, ...withoutId(lists.done, intent.id)].slice(0, 10),
			};
		}
	}
}

/**
 * Project a flat open-task list (Today schedule seed) after an intent.
 * Completed non-recurring tasks leave the list; rolls stay open with new due.
 */
export function applyOpenTaskList(
	open: TaskRow[],
	intent: TaskIntent,
	ctx: ApplyContext,
): TaskRow[] {
	const { open: next } = applyTaskLists({ open, done: [] }, intent, ctx);
	return next;
}

/** Patch tasks embedded in day-schedule bands by id. */
export function mapScheduleTasks(
	items: Array<{ kind: string; task?: TaskRow; [k: string]: unknown }>,
	byId: Map<string, TaskRow>,
): typeof items {
	return items.flatMap((item) => {
		if (item.kind !== "task" || !item.task) return [item];
		const next = byId.get(item.task.id);
		if (!next) return []; // removed (completed)
		if (next.status === "done") return [];
		return [{ ...item, task: next }];
	});
}
