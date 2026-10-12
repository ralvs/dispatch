"use client";

import { toastNotice, toastSuccess } from "@/lib/client/toast";
import { formatDueLabel } from "@/lib/dates";
import type { TaskRow } from "@/lib/schemas/task";
import type { Write } from "@/lib/store/write";
import { nextCompleteFields } from "@/lib/task-interaction/apply-intent";
import { taskWrites } from "@/lib/writes/task";

/** The part of `useWrites()` a row's handlers run task writes through. */
export type TaskSender = { send(w: Write<"task">): boolean };

/**
 * Parent-owned intents (the entity store applies, then the server action).
 * Both task rows take this shape: the Tasks page's and Today's.
 */
export type TaskRowHandlers = {
	onToggleDone: () => void;
	onToggleTop3: () => void;
	onDelete?: () => void;
};

/**
 * A recurring tick saves this cycle as done and moves the task to its next
 * cycle (docs/adr/0083); a skip moves it with nothing saved. Either way the
 * pill names where the task went next. Fired on claim, not after the server
 * round-trip, so it lands with the optimistic tick.
 */
export function toastTaskToggle(
	kind: "complete" | "reopen" | "skip",
	task: Pick<TaskRow, "recurrence_rule" | "due_date" | "recurrence_day">,
	todayIso: string,
): void {
	if (kind === "reopen") {
		toastNotice("Reopened");
		return;
	}
	const next = nextCompleteFields(task, { todayIso });
	const label = kind === "skip" ? "Skipped" : "Done";
	if (next.spawn?.due_date) {
		toastSuccess(label, `Next ${formatDueLabel(next.spawn.due_date, todayIso)}`);
		return;
	}
	toastSuccess(label);
}

/** Desired-state star flag — the same comparison projectTask makes. */
export function top3DesiredState(
	task: Pick<TaskRow, "top3_for_date">,
	forDateIso: string,
): boolean {
	return task.top3_for_date !== forDateIso;
}

/**
 * How long a second tick or skip on the same recurring row counts as the same
 * click. The row stays open after a tick (docs/adr/0083), so its box is empty
 * again at once: without this, a double click ticks two cycles. The server's
 * gate cannot tell, because the second click saw the new due date.
 */
const RECURRING_REPEAT_MS = 800;
const lastRecurringMove = new Map<string, number>();

/** Whether this recurring row moved a moment ago. */
function movedJustNow(id: string): boolean {
	const last = lastRecurringMove.get(id);
	return last !== undefined && Date.now() - last < RECURRING_REPEAT_MS;
}

/**
 * Skip this cycle of a recurring task (docs/adr/0083): it moves to its next
 * due date and nothing is saved as done. Offered in the task's edit form, not
 * on the row, so a stray tap never skips. Same gate as a tick: the due date
 * the form showed.
 */
export function skipRecurringTask(task: TaskRow, writes: TaskSender, todayIso: string): void {
	if (task.status !== "open" || task.recurrence_rule === null || movedJustNow(task.id)) return;
	if (!writes.send(taskWrites.skip({ id: task.id, observedDueDate: task.due_date }))) return;
	lastRecurringMove.set(task.id, Date.now());
	toastTaskToggle("skip", task, todayIso);
}

/**
 * Bind a row's checkbox and star to the task writes (lib/writes/task.ts).
 * `top3DateIso` is the day the star pins to (today on Tasks; day on screen on Today).
 * `todayIso` is the real calendar today — a recurring task's next cycle is dated from it, not the day on screen.
 */
export function bindTaskHandlers(
	task: TaskRow,
	writes: TaskSender,
	opts: { top3DateIso: string; todayIso: string },
) {
	const done = task.status === "done";
	const recurring = !done && task.recurrence_rule !== null;
	return {
		onToggleDone: () => {
			if (done) {
				if (!writes.send(taskWrites.reopen(task.id))) return;
				toastTaskToggle("reopen", task, opts.todayIso);
			} else {
				if (recurring && movedJustNow(task.id)) return;
				const w = taskWrites.complete({
					id: task.id,
					observedDueDate: task.due_date,
					// The snapshot shows at once under the id the server will give it.
					...(recurring ? { snapshotId: crypto.randomUUID() } : {}),
				});
				if (!writes.send(w)) return;
				if (recurring) lastRecurringMove.set(task.id, Date.now());
				toastTaskToggle("complete", task, opts.todayIso);
			}
		},
		onToggleTop3: () => {
			writes.send(
				taskWrites.setTop3({
					id: task.id,
					starred: top3DesiredState(task, opts.top3DateIso),
					forDateIso: opts.top3DateIso,
				}),
			);
		},
	};
}
