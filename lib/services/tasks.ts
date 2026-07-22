import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INBOX_DOMAIN_ID } from "@/lib/constants";
import { nowUtc } from "@/lib/dates";
import { isRecurrencePattern, nextDueDate } from "@/lib/recurrence";
import { TASK_SELECT, type TaskRow } from "@/lib/schemas/task";
import { unwrap } from "@/lib/services/errors";

export type { TaskRow } from "@/lib/schemas/task";

// supabase-js types FK joins as arrays; flatten to single objects.
// biome-ignore lint/suspicious/noExplicitAny: PostgREST row shape normalized here once
function flatten(row: any): TaskRow {
	return {
		...row,
		domain: Array.isArray(row.domain) ? (row.domain[0] ?? null) : row.domain,
		project: Array.isArray(row.project) ? (row.project[0] ?? null) : row.project,
	};
}

export async function listTasks(
	sb: SupabaseClient,
	filters: { status?: "open" | "done"; domainId?: string; projectId?: string } = {},
): Promise<TaskRow[]> {
	let q = sb
		.from("tasks")
		.select(TASK_SELECT)
		.order("due_date", { ascending: true, nullsFirst: false })
		.order("priority", { ascending: true })
		.order("created_at", { ascending: false });
	if (filters.status) q = q.eq("status", filters.status);
	if (filters.domainId) q = q.eq("domain_id", filters.domainId);
	if (filters.projectId) q = q.eq("project_id", filters.projectId);
	const data = unwrap(await q);
	return (data ?? []).map(flatten);
}

export async function listInboxTasks(sb: SupabaseClient): Promise<TaskRow[]> {
	return listTasks(sb, { status: "open", domainId: INBOX_DOMAIN_ID });
}

/** Recently completed tasks only — Tasks page strip, not full history. */
export async function listRecentDone(sb: SupabaseClient, limit = 10): Promise<TaskRow[]> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select(TASK_SELECT)
			.eq("status", "done")
			.order("completed_at", { ascending: false, nullsFirst: false })
			.limit(limit),
	);
	return (data ?? []).map(flatten);
}

/**
 * Most recent completion instant per domain, from the latest done tasks.
 * One bounded query, reduced in JS — 500 rows comfortably covers every
 * domain's recent activity for cadence math.
 */
export async function lastCompletedByDomain(sb: SupabaseClient): Promise<Record<string, string>> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select("domain_id, completed_at")
			.eq("status", "done")
			.not("completed_at", "is", null)
			.order("completed_at", { ascending: false })
			.limit(500),
	);
	const latest: Record<string, string> = {};
	for (const row of (data ?? []) as Array<{ domain_id: string; completed_at: string }>) {
		if (!(row.domain_id in latest)) latest[row.domain_id] = row.completed_at;
	}
	return latest;
}

export async function getTask(sb: SupabaseClient, id: string): Promise<TaskRow | null> {
	const data = unwrap(await sb.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle());
	return data ? flatten(data) : null;
}

/** Minimal columns for complete/top3 — avoids joined domain/project on the hot path. */
type TaskHotRow = {
	id: string;
	recurrence_rule: string | null;
	due_date: string | null;
	top3_for_date: string | null;
};

async function getTaskHot(sb: SupabaseClient, id: string): Promise<TaskHotRow | null> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select("id, recurrence_rule, due_date, top3_for_date")
			.eq("id", id)
			.maybeSingle(),
	);
	return (data as TaskHotRow | null) ?? null;
}

export async function createTask(
	sb: SupabaseClient,
	input: {
		title: string;
		notes?: string | null;
		due_date?: string | null;
		due_time?: string | null;
		priority?: number;
		domain_id?: string | null;
		project_id?: string | null;
		recurrence_rule?: string | null;
		source?: string;
	},
): Promise<TaskRow> {
	const data = unwrap(
		await sb
			.from("tasks")
			.insert({
				...input,
				// Tasks without a destination land in the Inbox for triage.
				domain_id: input.domain_id ?? INBOX_DOMAIN_ID,
				source: input.source ?? "manual",
			})
			.select(TASK_SELECT)
			.single(),
	);
	return flatten(data);
}

export async function updateTask(
	sb: SupabaseClient,
	id: string,
	patch: Partial<{
		title: string;
		notes: string | null;
		due_date: string | null;
		due_time: string | null;
		priority: number;
		domain_id: string;
		project_id: string | null;
		recurrence_rule: string | null;
	}>,
): Promise<void> {
	unwrap(await sb.from("tasks").update(patch).eq("id", id));
}

/**
 * Complete a task. Recurring tasks don't close — the due date rolls forward
 * to the next occurrence (reference semantics: an overdue weekly task rolls
 * from today, never into the past).
 */
export async function completeTask(
	sb: SupabaseClient,
	id: string,
	todayIso: string,
): Promise<{ rolled: boolean }> {
	const task = await getTaskHot(sb, id);
	if (!task) throw new Error("Task not found");

	if (task.recurrence_rule && isRecurrencePattern(task.recurrence_rule)) {
		const due = nextDueDate({
			currentDue: task.due_date,
			rule: task.recurrence_rule,
			todayIso,
		});
		unwrap(await sb.from("tasks").update({ due_date: due }).eq("id", id));
		return { rolled: true };
	}

	unwrap(await sb.from("tasks").update({ status: "done", completed_at: nowUtc() }).eq("id", id));
	return { rolled: false };
}

export async function reopenTask(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("tasks").update({ status: "open", completed_at: null }).eq("id", id));
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("tasks").delete().eq("id", id));
}

/** Star / unstar a task as one of today's top 3. */
export async function toggleTop3(sb: SupabaseClient, id: string, todayIso: string): Promise<void> {
	const task = await getTaskHot(sb, id);
	if (!task) throw new Error("Task not found");
	const next = task.top3_for_date === todayIso ? null : todayIso;
	unwrap(await sb.from("tasks").update({ top3_for_date: next }).eq("id", id));
}

/** Inbox triage: give a task a real home. */
export async function triageTask(sb: SupabaseClient, id: string, domainId: string): Promise<void> {
	unwrap(await sb.from("tasks").update({ domain_id: domainId }).eq("id", id));
}
