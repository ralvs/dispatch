"use client";

import type { ActionResult } from "@/lib/action-result";
import { toastNotice, toastSuccess } from "@/lib/client/toast";
import { formatDueLabel } from "@/lib/dates";
import type { TaskRow } from "@/lib/schemas/task";
import { useRunIntent } from "@/lib/store/run";
import type { StoreWrite } from "@/lib/store/types";
import { nextCompleteFields, type TaskIntent } from "@/lib/task-interaction/apply-intent";

const DEFAULT_ERROR = "Couldn't update that task. Try again.";

/** What every task action resolves to: the rows it wrote, for the entity store. */
export type TaskActionResult = ActionResult<StoreWrite<TaskRow>>;

/**
 * Parent-owned intents (the entity store applies, then the server action).
 * Both task rows take this shape: the Tasks page's and Today's.
 */
export type TaskRowHandlers = {
	onToggleDone: () => void;
	onToggleTop3: () => void;
	onDelete?: () => void;
	/** Only on an open recurring row: skip this cycle (docs/adr/0083). */
	onSkip?: () => void;
};

export type TaskIntentRun = (
	intent: TaskIntent,
	action: () => Promise<TaskActionResult>,
) => boolean;

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

/**
 * Apply to the entity store → server action → confirm or roll back
 * (lib/store/run.ts). Surfaces only supply the intent and the action (so this
 * module never imports server actions).
 */
export function useTaskIntentRunner(errorMessage: string = DEFAULT_ERROR): TaskIntentRun {
	return useRunIntent("task", { errorMessage });
}

/** Desired-state star flag — the same comparison projectTask makes. */
export function top3DesiredState(
	task: Pick<TaskRow, "top3_for_date">,
	forDateIso: string,
): boolean {
	return task.top3_for_date !== forDateIso;
}

export type TaskWriteActions = {
	complete: (input: {
		id: string;
		observedDueDate: string | null;
		snapshotId?: string;
	}) => Promise<TaskActionResult>;
	reopen: (id: string) => Promise<TaskActionResult>;
	skip?: (input: { id: string; observedDueDate: string | null }) => Promise<TaskActionResult>;
	setTop3: (input: {
		id: string;
		starred: boolean;
		forDateIso?: string;
	}) => Promise<TaskActionResult>;
	delete?: (id: string) => Promise<TaskActionResult>;
};

/**
 * Bind a row's checkbox / star / delete to intent + preconditioned actions.
 * `top3DateIso` is the day the star pins to (today on Tasks; day on screen on Today).
 * `todayIso` is the real calendar today — a recurring task's next cycle is dated from it, not the day on screen.
 */
export function bindTaskHandlers(
	task: TaskRow,
	run: TaskIntentRun,
	actions: TaskWriteActions,
	opts: { top3DateIso: string; todayIso: string },
) {
	const done = task.status === "done";
	const recurring = !done && task.recurrence_rule !== null;
	return {
		onToggleDone: () => {
			if (done) {
				if (!run({ type: "reopen", id: task.id }, () => actions.reopen(task.id))) return;
				toastTaskToggle("reopen", task, opts.todayIso);
			} else {
				const intent = {
					type: "complete" as const,
					id: task.id,
					observedDueDate: task.due_date,
					// The snapshot shows at once under the id the server will give it.
					...(recurring ? { snapshotId: crypto.randomUUID() } : {}),
				};
				if (
					!run(intent, () =>
						actions.complete({
							id: intent.id,
							observedDueDate: intent.observedDueDate,
							snapshotId: intent.snapshotId,
						}),
					)
				) {
					return;
				}
				toastTaskToggle("complete", task, opts.todayIso);
			}
		},
		onToggleTop3: () => {
			const intent = {
				type: "setTop3" as const,
				id: task.id,
				starred: top3DesiredState(task, opts.top3DateIso),
				forDateIso: opts.top3DateIso,
			};
			run(intent, () =>
				actions.setTop3({
					id: intent.id,
					starred: intent.starred,
					forDateIso: intent.forDateIso,
				}),
			);
		},
		...(recurring && actions.skip
			? {
					onSkip: () => {
						const skip = actions.skip;
						if (!skip) return;
						const intent = {
							type: "skip" as const,
							id: task.id,
							observedDueDate: task.due_date,
						};
						if (
							!run(intent, () => skip({ id: intent.id, observedDueDate: intent.observedDueDate }))
						) {
							return;
						}
						toastTaskToggle("skip", task, opts.todayIso);
					},
				}
			: {}),
		...(actions.delete
			? {
					onDelete: () => {
						const del = actions.delete;
						if (!del) return;
						run({ type: "delete", id: task.id }, () => del(task.id));
					},
				}
			: {}),
	};
}
