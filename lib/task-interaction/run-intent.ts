"use client";

import { useCallback, useTransition } from "react";
import { runAction, toastNotice, toastSuccess } from "@/lib/client/toast";
import { formatDueLabel } from "@/lib/dates";
import type { TaskRow } from "@/lib/schemas/task";
import { nextCompleteFields, type TaskIntent } from "@/lib/task-interaction/apply-intent";
import { useIntentLock } from "@/lib/task-interaction/intent-lock";

const DEFAULT_ERROR = "Couldn't update that task. Try again.";

export type TaskIntentRun = (intent: TaskIntent, action: () => Promise<unknown>) => boolean;

/**
 * Recurring complete does not close the row — the checkbox springs back
 * (docs/adr/0037). The due-date label is the only other signal and is easy
 * to miss, so the success pill is the confirmation. Fired on claim, not
 * after the server round-trip, so the pill lands with the optimistic tick.
 */
export function toastTaskToggle(
	kind: "complete" | "reopen",
	task: Pick<TaskRow, "recurrence_rule" | "due_date">,
	todayIso: string,
): void {
	if (kind === "reopen") {
		toastNotice("Reopened");
		return;
	}
	const next = nextCompleteFields(task, { todayIso });
	if (next.rolled && next.due_date) {
		toastSuccess("Done", formatDueLabel(next.due_date, todayIso));
		return;
	}
	toastSuccess("Done");
}

/**
 * Claim → optimistic dispatch → server action → release.
 *
 * Owns the ADR-0037 replay lock for `complete`. Surfaces only supply the
 * intent and the action (so this module never imports server actions).
 */
export function useTaskIntentRunner(
	dispatchOptimistic: (intent: TaskIntent) => void,
	errorMessage: string = DEFAULT_ERROR,
): TaskIntentRun {
	const lock = useIntentLock();
	const [, startTransition] = useTransition();

	return useCallback(
		(intent: TaskIntent, action: () => Promise<unknown>) => {
			if (!lock.claim(intent)) return false;
			startTransition(async () => {
				dispatchOptimistic(intent);
				// On failure optimistic state rolls back when the transition ends.
				await runAction(action, errorMessage);
				lock.release(intent);
			});
			return true;
		},
		[lock, dispatchOptimistic, errorMessage],
	);
}

/** Desired-state star flag — same comparison the optimistic reducer makes. */
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
	}) => Promise<{ rolled: boolean; nextDue: string | null; applied: boolean }>;
	reopen: (id: string) => Promise<void>;
	setTop3: (input: { id: string; starred: boolean; forDateIso?: string }) => Promise<void>;
	delete?: (id: string) => Promise<void>;
};

/**
 * Bind a row's checkbox / star / delete to intent + preconditioned actions.
 * `top3DateIso` is the day the star pins to (today on Tasks; day on screen on Today).
 * `todayIso` is the real calendar today — recurrence rolls from it, not the day on screen.
 */
export function bindTaskHandlers(
	task: TaskRow,
	run: TaskIntentRun,
	actions: TaskWriteActions,
	opts: { top3DateIso: string; todayIso: string },
) {
	const done = task.status === "done";
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
				};
				if (
					!run(intent, () =>
						actions.complete({ id: intent.id, observedDueDate: intent.observedDueDate }),
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
