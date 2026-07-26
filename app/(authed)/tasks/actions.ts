"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
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
	toggleTop3,
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
		domain_id: parsed.domain_id || null,
		recurrence_rule: parsed.recurrence_rule || null,
	});
	afterMutation("task.write");
}

export async function quickAddTaskAction({ text }: { text: string }) {
	const { sb } = await requireOwnerPage();
	const parsed = z.object({ text: z.string().trim().min(1).max(1000) }).parse({ text });
	await quickAddTask(sb, parsed.text);
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
		domain_id: parsed.domain_id || undefined,
		recurrence_rule: parsed.recurrence_rule || null,
	});
	afterMutation("task.write");
}

export async function completeTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await completeTask(sb, z.uuid().parse(id), await todayForRequest(sb));
	afterMutation("task.write");
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

export async function toggleTop3Action(id: string) {
	const { sb } = await requireOwnerPage();
	await toggleTop3(sb, z.uuid().parse(id), await todayForRequest(sb));
	afterMutation("task.write");
}

export async function assignDomainAction(id: string, domainId: string) {
	const { sb } = await requireOwnerPage();
	await assignDomain(sb, z.uuid().parse(id), z.uuid().parse(domainId));
	afterMutation("task.assign");
}
