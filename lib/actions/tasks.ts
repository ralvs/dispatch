"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { acceptedDay, parseDateIso } from "@/lib/dates";
import { afterMutation } from "@/lib/invalidate";
import { type TaskRow, taskForm, taskFormFields } from "@/lib/schemas/task";
import { quickAddTask } from "@/lib/services/capture/quick-add";
import { todayForRequest } from "@/lib/services/settings";
import {
	assignDomain,
	completeTask,
	createTask,
	deleteTask,
	reopenTask,
	setTop3,
	skipTask,
	updateTask,
} from "@/lib/services/tasks";
import { written } from "@/lib/services/written";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the rows it wrote (#26), so the client's entity store
// confirms its optimistic intent from them instead of waiting on a page
// render. Failures that are not a form's field errors still throw; the store
// runner rolls back on a throw.

type TaskWrite = StoreWrite<TaskRow>;

export async function createTaskAction(formData: FormData): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const task = await createTask(sb, taskFormFields(taskForm.parse(formData)));
		afterMutation("task.write");
		return stampWrite([task]);
	});
}

export async function quickAddTaskAction({
	text,
	domainId,
}: {
	text: string;
	domainId: string;
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	// The domain the operator picked on the form, which the parser must not
	// override (lib/services/capture/quick-add.ts). Untrusted like any client
	// argument, so it is parsed rather than trusted — and REQUIRED, for the
	// same reason CreateTaskFormSchema requires it: this is the form's other
	// submit path, and a rule that only one of the two enforces is not a rule.
	// The service keeps `domainId` optional because capture legitimately has
	// none; this action is the form, and the form always does.
	const parsed = z
		.object({ text: z.string().trim().min(1).max(1000), domainId: z.uuid() })
		.parse({ text, domainId });
	const { task } = await quickAddTask(sb, parsed.text, { domainId: parsed.domainId });
	afterMutation("task.write");
	return { ok: true, data: stampWrite([task]) };
}

export async function updateTaskAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const fields = taskFormFields(taskForm.parse(formData));
		const taskId = z.uuid().parse(id);
		// Create and edit send the same columns: the domain cannot be empty, so
		// an edit no longer reads a blank one as "leave it alone".
		await updateTask(sb, taskId, fields);
		afterMutation("task.write");
		return written(sb, "task", taskId);
	});
}

/** A client-sent date the row was showing: parsed, never trusted. */
function observedDate(value: string | null): string | null {
	if (value !== null && parseDateIso(value) === null) {
		throw new Error(`Invalid observed due date: ${value}`);
	}
	return value;
}

/**
 * How many days behind the server's today a tick's day may be: a tab that
 * slept past midnight still ticks the day it showed (docs/adr/0077).
 */
const TICK_DAYS_BACK = 1;

/**
 * The day the client applied the intent with, which a recurring task's next
 * cycle is dated from. Checked against the server's today (iron rule #1).
 */
async function tickDay(sb: Parameters<typeof todayForRequest>[0], requested: unknown) {
	const day = acceptedDay(requested, await todayForRequest(sb), TICK_DAYS_BACK);
	if (day === null)
		throw new Error(`Tick day is outside the accepted window: ${String(requested)}`);
	return day;
}

/**
 * `observedDueDate` is the due date the clicked row was showing — the
 * precondition that keeps a replayed completion from moving a recurring task
 * forward a second cycle (docs/adr/0037). Untrusted like any client argument,
 * so it is parsed rather than trusted. `todayIso` is the day the client
 * applied the tick with; the next cycle is dated from it (docs/adr/0077).
 *
 * Returns the row as it stands even when the precondition rejected the write
 * (`applied: false`): the row is then already done, or has moved on, and the
 * store must show that rather than revert the tick. A recurring tick returns
 * the done snapshot it saved too (docs/adr/0083), under `snapshotId` when the
 * client named one.
 */
export async function completeTaskAction(input: {
	id: string;
	observedDueDate: string | null;
	snapshotId?: string;
	todayIso: string;
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const observed = observedDate(input.observedDueDate);
	const id = z.uuid().parse(input.id);
	const snapshotId = input.snapshotId === undefined ? undefined : z.uuid().parse(input.snapshotId);
	const result = await completeTask(
		sb,
		id,
		await tickDay(sb, input.todayIso),
		{ dueDate: observed },
		{ snapshotId },
	);
	afterMutation("task.write");
	return {
		ok: true,
		data: await written(sb, "task", id, { also: result.snapshot ? [result.snapshot] : [] }),
	};
}

/**
 * Skip one cycle of a recurring task (docs/adr/0083). Same precondition as a
 * tick; a refused skip returns the row as it stands.
 */
export async function skipTaskAction(input: {
	id: string;
	observedDueDate: string | null;
	todayIso: string;
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const observed = observedDate(input.observedDueDate);
	const id = z.uuid().parse(input.id);
	await skipTask(sb, id, await tickDay(sb, input.todayIso), { dueDate: observed });
	afterMutation("task.write");
	return { ok: true, data: await written(sb, "task", id) };
}

/**
 * Un-ticking the latest snapshot of a recurring task deletes it and moves
 * the recurring row back (docs/adr/0083): the write then carries that row and
 * the snapshot's id as deleted.
 */
export async function reopenTaskAction(id: string): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const taskId = z.uuid().parse(id);
	const { seriesId } = await reopenTask(sb, taskId);
	afterMutation("task.write");
	if (!seriesId) return { ok: true, data: await written(sb, "task", taskId) };
	const series = await written(sb, "task", seriesId);
	return {
		ok: true,
		data: { ...series, deletedIds: [...(series.deletedIds ?? []), taskId] },
	};
}

export async function deleteTaskAction(id: string): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const taskId = z.uuid().parse(id);
	await deleteTask(sb, taskId);
	afterMutation("task.write");
	return { ok: true, data: stampWrite([], [taskId]) };
}

/**
 * `forDateIso` lets Today's day navigation build another day's shortlist —
 * starring while reading tomorrow pins to tomorrow. Untrusted like any client
 * argument, so it is parsed rather than trusted, and omitting it keeps the
 * original behaviour (pin to today).
 */
export async function setTop3Action(input: {
	id: string;
	starred: boolean;
	forDateIso?: string;
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const target = input.forDateIso === undefined ? null : parseDateIso(input.forDateIso);
	if (input.forDateIso !== undefined && target === null) {
		throw new Error(`Invalid top-3 date: ${input.forDateIso}`);
	}
	const id = z.uuid().parse(input.id);
	await setTop3(sb, id, {
		forDateIso: target ?? (await todayForRequest(sb)),
		starred: input.starred,
	});
	afterMutation("task.write");
	return { ok: true, data: await written(sb, "task", id) };
}

export async function assignDomainAction(
	id: string,
	domainId: string,
): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const taskId = z.uuid().parse(id);
	await assignDomain(sb, taskId, z.uuid().parse(domainId));
	afterMutation("task.assign");
	return { ok: true, data: await written(sb, "task", taskId) };
}
