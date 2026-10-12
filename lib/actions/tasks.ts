"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { parseDateIso } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/invalidate";
import { CreateTaskFormSchema, type TaskRow } from "@/lib/schemas/task";
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
		const parsed = decodeForm(CreateTaskFormSchema, formData);
		const task = await createTask(sb, {
			title: parsed.title,
			notes: parsed.notes || null,
			due_date: parsed.due_date || null,
			due_time: parsed.due_time || null,
			priority: parsed.priority,
			// Guaranteed by CreateTaskFormSchema — this form cannot make an unfiled task.
			domain_id: parsed.domain_id,
			project_id: parsed.project_id || null,
			recurrence_rule: parsed.recurrence_rule || null,
		});
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
		const parsed = decodeForm(CreateTaskFormSchema, formData);
		const taskId = z.uuid().parse(id);
		await updateTask(sb, taskId, {
			title: parsed.title,
			notes: parsed.notes || null,
			due_date: parsed.due_date || null,
			due_time: parsed.due_time || null,
			priority: parsed.priority,
			// The two mappings used to differ: an empty domain meant "leave it alone"
			// on edit and "Inbox" on create. The field cannot be empty any more, so
			// there is one answer and both paths send it.
			domain_id: parsed.domain_id,
			// Null, not undefined: clearing the select is how a task leaves a
			// project, and the field is always present on the form.
			project_id: parsed.project_id || null,
			recurrence_rule: parsed.recurrence_rule || null,
		});
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
 * `observedDueDate` is the due date the clicked row was showing — the
 * precondition that keeps a replayed completion from moving a recurring task
 * forward a second cycle (docs/adr/0037). Untrusted like any client argument,
 * so it is parsed rather than trusted.
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
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const observed = observedDate(input.observedDueDate);
	const id = z.uuid().parse(input.id);
	const snapshotId = input.snapshotId === undefined ? undefined : z.uuid().parse(input.snapshotId);
	const result = await completeTask(
		sb,
		id,
		await todayForRequest(sb),
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
}): Promise<ActionResult<TaskWrite>> {
	const { sb } = await requireOwnerPage();
	const observed = observedDate(input.observedDueDate);
	const id = z.uuid().parse(input.id);
	await skipTask(sb, id, await todayForRequest(sb), { dueDate: observed });
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
