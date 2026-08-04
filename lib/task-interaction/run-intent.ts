"use client";

import { useCallback, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/schemas/task";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";
import { useIntentLock } from "@/lib/task-interaction/intent-lock";

const DEFAULT_ERROR = "Couldn't update that task. Try again.";

export type TaskIntentRun = (intent: TaskIntent, action: () => Promise<void>) => void;

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
		(intent: TaskIntent, action: () => Promise<void>) => {
			if (!lock.claim(intent)) return;
			startTransition(async () => {
				dispatchOptimistic(intent);
				// On failure optimistic state rolls back when the transition ends.
				await runAction(action, errorMessage);
				lock.release(intent);
			});
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
	complete: (input: { id: string; observedDueDate: string | null }) => Promise<void>;
	reopen: (id: string) => Promise<void>;
	setTop3: (input: { id: string; starred: boolean; forDateIso?: string }) => Promise<void>;
	delete?: (id: string) => Promise<void>;
};

/**
 * Bind a row's checkbox / star / delete to intent + preconditioned actions.
 * `top3DateIso` is the day the star pins to (today on Tasks; day on screen on Today).
 */
export function bindTaskHandlers(
	task: TaskRow,
	run: TaskIntentRun,
	actions: TaskWriteActions,
	opts: { top3DateIso: string },
) {
	const done = task.status === "done";
	return {
		onToggleDone: () => {
			if (done) {
				run({ type: "reopen", id: task.id }, () => actions.reopen(task.id));
			} else {
				run({ type: "complete", id: task.id }, () =>
					actions.complete({ id: task.id, observedDueDate: task.due_date }),
				);
			}
		},
		onToggleTop3: () => {
			const starred = top3DesiredState(task, opts.top3DateIso);
			run({ type: "toggleTop3", id: task.id }, () =>
				actions.setTop3({ id: task.id, starred, forDateIso: opts.top3DateIso }),
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
