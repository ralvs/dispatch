"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { parseDateIso } from "@/lib/dates";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateTaskFormSchema } from "@/lib/schemas/task";
import { quickAddTask } from "@/lib/services/capture/quick-add";
import { todayForRequest } from "@/lib/services/settings";
import {
	assignDomain,
	completeTask,
	createTask,
	deleteTask,
	reopenTask,
	setTop3,
	updateTask,
} from "@/lib/services/tasks";

export async function createTaskAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateTaskFormSchema.parse(Object.fromEntries(formData));
	await createTask(sb, {
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
}

export async function quickAddTaskAction({ text, domainId }: { text: string; domainId: string }) {
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
	await quickAddTask(sb, parsed.text, { domainId: parsed.domainId });
	afterMutation("task.write");
}

export async function updateTaskAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateTaskFormSchema.parse(Object.fromEntries(formData));
	await updateTask(sb, z.uuid().parse(id), {
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
}

/**
 * `observedDueDate` is the due date the clicked row was showing — the
 * precondition that keeps a replayed completion from rolling a recurring task
 * forward a second interval (docs/adr/0037). Untrusted like any client
 * argument, so it is parsed rather than trusted.
 */
export async function completeTaskAction(input: { id: string; observedDueDate: string | null }) {
	const { sb } = await requireOwnerPage();
	if (input.observedDueDate !== null && parseDateIso(input.observedDueDate) === null) {
		throw new Error(`Invalid observed due date: ${input.observedDueDate}`);
	}
	const result = await completeTask(sb, z.uuid().parse(input.id), await todayForRequest(sb), {
		dueDate: input.observedDueDate,
	});
	// Revalidates even when the precondition rejected the write: the optimistic
	// transition on the client is waiting for an RSC payload to settle into,
	// and skipping it would strand the row on stale props. ADR-0035's
	// "only act when rows moved" is scoped to afterExternalMutation, which has
	// no transition on the other end.
	afterMutation("task.write");
	return result;
}

export async function reopenTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await reopenTask(sb, z.uuid().parse(id));
	afterMutation("task.write");
}

export async function deleteTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteTask(sb, z.uuid().parse(id));
	afterMutation("task.write");
}

/**
 * `forDateIso` lets Today's day navigation build another day's shortlist —
 * starring while reading tomorrow pins to tomorrow. Untrusted like any client
 * argument, so it is parsed rather than trusted, and omitting it keeps the
 * original behaviour (pin to today).
 */
export async function setTop3Action(input: { id: string; starred: boolean; forDateIso?: string }) {
	const { sb } = await requireOwnerPage();
	const target = input.forDateIso === undefined ? null : parseDateIso(input.forDateIso);
	if (input.forDateIso !== undefined && target === null) {
		throw new Error(`Invalid top-3 date: ${input.forDateIso}`);
	}
	await setTop3(sb, z.uuid().parse(input.id), {
		forDateIso: target ?? (await todayForRequest(sb)),
		starred: input.starred,
	});
	afterMutation("task.write");
}

export async function assignDomainAction(id: string, domainId: string) {
	const { sb } = await requireOwnerPage();
	await assignDomain(sb, z.uuid().parse(id), z.uuid().parse(domainId));
	afterMutation("task.assign");
}
