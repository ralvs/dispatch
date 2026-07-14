"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { RECURRENCE_PATTERNS } from "@/lib/recurrence";
import { getAppTimezone } from "@/lib/services/settings";
import {
	completeTask,
	createTask,
	deleteTask,
	reopenTask,
	toggleTop3,
	triageTask,
} from "@/lib/services/tasks";
import { createRlsClient } from "@/lib/supabase/server";

function revalidateTaskViews() {
	revalidatePath("/tasks");
	revalidatePath("/inbox");
	revalidatePath("/today");
}

const CreateTaskSchema = z.object({
	title: z.string().trim().min(1).max(500),
	notes: z.string().trim().max(5000).optional(),
	due_date: z.iso.date().optional().or(z.literal("")),
	due_time: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional()
		.or(z.literal("")),
	priority: z.coerce.number().int().min(1).max(4).default(4),
	domain_id: z.uuid().optional().or(z.literal("")),
	recurrence_rule: z.enum(RECURRENCE_PATTERNS).optional().or(z.literal("")),
});

export async function createTaskAction(formData: FormData) {
	await requireOwnerPage();
	const parsed = CreateTaskSchema.parse(Object.fromEntries(formData));
	const sb = await createRlsClient();
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

export async function completeTaskAction(id: string) {
	await requireOwnerPage();
	const sb = await createRlsClient();
	const tz = await getAppTimezone(sb);
	await completeTask(sb, z.uuid().parse(id), todayInTz(tz));
	revalidateTaskViews();
}

export async function reopenTaskAction(id: string) {
	await requireOwnerPage();
	const sb = await createRlsClient();
	await reopenTask(sb, z.uuid().parse(id));
	revalidateTaskViews();
}

export async function deleteTaskAction(id: string) {
	await requireOwnerPage();
	const sb = await createRlsClient();
	await deleteTask(sb, z.uuid().parse(id));
	revalidateTaskViews();
}

export async function toggleTop3Action(id: string) {
	await requireOwnerPage();
	const sb = await createRlsClient();
	const tz = await getAppTimezone(sb);
	await toggleTop3(sb, z.uuid().parse(id), todayInTz(tz));
	revalidateTaskViews();
}

export async function triageTaskAction(id: string, domainId: string) {
	await requireOwnerPage();
	const sb = await createRlsClient();
	await triageTask(sb, z.uuid().parse(id), z.uuid().parse(domainId));
	revalidateTaskViews();
}
