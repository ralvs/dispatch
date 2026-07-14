import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INBOX_DOMAIN_ID } from "@/lib/constants";
import { nowUtc } from "@/lib/dates";
import { isRecurrencePattern, nextDueDate } from "@/lib/recurrence";

export type TaskRow = {
	id: string;
	title: string;
	notes: string | null;
	status: "open" | "done";
	due_date: string | null;
	due_time: string | null;
	priority: number;
	project_id: string | null;
	domain_id: string;
	recurrence_rule: string | null;
	top3_for_date: string | null;
	source: string;
	created_at: string;
	completed_at: string | null;
	domain?: { id: string; name: string } | null;
	project?: { id: string; name: string } | null;
};

const TASK_SELECT =
	"id, title, notes, status, due_date, due_time, priority, project_id, domain_id, recurrence_rule, top3_for_date, source, created_at, completed_at, domain:stewardship_domains(id, name), project:projects(id, name)";

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
	const { data, error } = await q;
	if (error) throw error;
	return (data ?? []).map(flatten);
}

export async function listInboxTasks(sb: SupabaseClient): Promise<TaskRow[]> {
	return listTasks(sb, { status: "open", domainId: INBOX_DOMAIN_ID });
}

export async function getTask(sb: SupabaseClient, id: string): Promise<TaskRow | null> {
	const { data, error } = await sb.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
	if (error) throw error;
	return data ? flatten(data) : null;
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
	const { data, error } = await sb
		.from("tasks")
		.insert({
			...input,
			// Tasks without a destination land in the Inbox for triage.
			domain_id: input.domain_id ?? INBOX_DOMAIN_ID,
			source: input.source ?? "manual",
		})
		.select(TASK_SELECT)
		.single();
	if (error) throw error;
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
	const { error } = await sb.from("tasks").update(patch).eq("id", id);
	if (error) throw error;
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
	const task = await getTask(sb, id);
	if (!task) throw new Error("Task not found");

	if (task.recurrence_rule && isRecurrencePattern(task.recurrence_rule)) {
		const due = nextDueDate({
			currentDue: task.due_date,
			rule: task.recurrence_rule,
			todayIso,
		});
		const { error } = await sb.from("tasks").update({ due_date: due }).eq("id", id);
		if (error) throw error;
		return { rolled: true };
	}

	const { error } = await sb
		.from("tasks")
		.update({ status: "done", completed_at: nowUtc() })
		.eq("id", id);
	if (error) throw error;
	return { rolled: false };
}

export async function reopenTask(sb: SupabaseClient, id: string): Promise<void> {
	const { error } = await sb
		.from("tasks")
		.update({ status: "open", completed_at: null })
		.eq("id", id);
	if (error) throw error;
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
	const { error } = await sb.from("tasks").delete().eq("id", id);
	if (error) throw error;
}

/** Star / unstar a task as one of today's top 3. */
export async function toggleTop3(sb: SupabaseClient, id: string, todayIso: string): Promise<void> {
	const task = await getTask(sb, id);
	if (!task) throw new Error("Task not found");
	const next = task.top3_for_date === todayIso ? null : todayIso;
	const { error } = await sb.from("tasks").update({ top3_for_date: next }).eq("id", id);
	if (error) throw error;
}

/** Inbox triage: give a task a real home. */
export async function triageTask(sb: SupabaseClient, id: string, domainId: string): Promise<void> {
	const { error } = await sb.from("tasks").update({ domain_id: domainId }).eq("id", id);
	if (error) throw error;
}

export async function listDomains(
	sb: SupabaseClient,
): Promise<Array<{ id: string; name: string; is_system: boolean }>> {
	const { data, error } = await sb
		.from("stewardship_domains")
		.select("id, name, is_system")
		.eq("active", true)
		.order("name");
	if (error) throw error;
	return data ?? [];
}
