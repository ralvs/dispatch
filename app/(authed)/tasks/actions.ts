"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { CreateTaskFormSchema } from "@/lib/schemas/task";
import { todayForRequest } from "@/lib/services/settings";
import {
	completeTask,
	createTask,
	deleteTask,
	reopenTask,
	toggleTop3,
	triageTask,
	updateTask,
} from "@/lib/services/tasks";

function revalidateTaskViews() {
	revalidatePath("/tasks");
	revalidatePath("/triage");
	revalidatePath("/today");
}

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
	revalidateTaskViews();
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
	revalidateTaskViews();
}

export async function completeTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await completeTask(sb, z.uuid().parse(id), await todayForRequest(sb));
	revalidateTaskViews();
}

export async function reopenTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await reopenTask(sb, z.uuid().parse(id));
	revalidateTaskViews();
}

export async function deleteTaskAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteTask(sb, z.uuid().parse(id));
	revalidateTaskViews();
}

export async function toggleTop3Action(id: string) {
	const { sb } = await requireOwnerPage();
	await toggleTop3(sb, z.uuid().parse(id), await todayForRequest(sb));
	revalidateTaskViews();
}

export async function triageTaskAction(id: string, domainId: string) {
	const { sb } = await requireOwnerPage();
	await triageTask(sb, z.uuid().parse(id), z.uuid().parse(domainId));
	revalidateTaskViews();
}
