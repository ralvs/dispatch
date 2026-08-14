import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayWindowUtc, nowUtc } from "@/lib/dates";
import { TASK_SELECT, type TaskRow } from "@/lib/schemas/task";
import { unwrap } from "@/lib/services/errors";
import { type GraphFail, syncTaskMentionsFromText } from "@/lib/services/mentions";
import { nextCompleteFields } from "@/lib/task-interaction/apply-intent";

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
	filters: {
		status?: "open" | "done";
		domainId?: string;
		/** Tasks with no domain at all — the inbox. Distinct from domainId. */
		unfiled?: boolean;
		projectId?: string;
	} = {},
): Promise<TaskRow[]> {
	let q = sb
		.from("tasks")
		.select(TASK_SELECT)
		.order("due_date", { ascending: true, nullsFirst: false })
		.order("priority", { ascending: true })
		.order("created_at", { ascending: false });
	if (filters.status) q = q.eq("status", filters.status);
	if (filters.domainId) q = q.eq("domain_id", filters.domainId);
	if (filters.unfiled) q = q.is("domain_id", null);
	if (filters.projectId) q = q.eq("project_id", filters.projectId);
	const data = unwrap(await q);
	return (data ?? []).map(flatten);
}

/** The /inbox queue: open tasks that were captured without a domain. */
export async function listInboxTasks(sb: SupabaseClient): Promise<TaskRow[]> {
	return listTasks(sb, { status: "open", unfiled: true });
}

/**
 * Tasks completed on one app-timezone calendar day.
 *
 * Today's day bands keep showing what was finished on the day being read
 * (docs/adr/0038) — a task ticked off at 09:00 must not vanish from the
 * timeline it was standing on. Scoped by `completed_at`, not by due date, so
 * an overdue task closed today counts as today's work.
 */
export async function listCompletedOn(
	sb: SupabaseClient,
	dateIso: string,
	tz: string,
): Promise<TaskRow[]> {
	const { startUtc, endUtc } = dayWindowUtc(dateIso, tz);
	const data = unwrap(
		await sb
			.from("tasks")
			.select(TASK_SELECT)
			.eq("status", "done")
			.gte("completed_at", startUtc)
			.lt("completed_at", endUtc)
			.order("completed_at", { ascending: true }),
	);
	return (data ?? []).map(flatten);
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
			// Unfiled tasks have no domain to attribute the completion to; letting
			// them through would key the cadence map on null.
			.not("domain_id", "is", null)
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

/** Escapes ilike wildcards so a search term is matched literally. */
function escapeLike(q: string): string {
	return q.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export type TaskSearchResult = {
	id: string;
	title: string;
	status: "open" | "done";
	due_date: string | null;
};

/** Title search for the note link picker — open tasks first, then most recent. */
export async function searchTasksByTitle(
	sb: SupabaseClient,
	q: string,
	limit = 8,
): Promise<TaskSearchResult[]> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select("id, title, status, due_date")
			.ilike("title", `%${escapeLike(q)}%`)
			.order("status", { ascending: false })
			.order("created_at", { ascending: false })
			.limit(limit),
	);
	return (data ?? []) as unknown as TaskSearchResult[];
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

export type TaskWriteOpts = {
	/** Capture swallows graph failures (iron rule #4). Forms throw. Default throw. */
	graphFail?: GraphFail;
};

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
	opts: TaskWriteOpts = {},
): Promise<TaskRow> {
	// due_time may only be set alongside a due_date (DB check constraint).
	// This is the one chokepoint every write path (form, capture) funnels
	// through, so it can enforce the invariant defensively — mirrors the
	// coercion in updateTask below rather than rejecting: a time with no
	// date to sit on is silently dropped instead of degrading the capture.
	const due_time = input.due_date ? input.due_time : null;
	const data = unwrap(
		await sb
			.from("tasks")
			.insert({
				...input,
				due_time,
				// A task without a stated destination is unfiled — no domain at all,
				// which is what the /inbox route selects on (docs/adr/0027). Stated
				// explicitly rather than left to the column default so the write says
				// what it means.
				domain_id: input.domain_id ?? null,
				source: input.source ?? "manual",
			})
			.select(TASK_SELECT)
			.single(),
	);
	const task = flatten(data);
	// Text write owns the person graph — callers must not post-sync.
	await syncTaskMentionsFromText(sb, task.id, input.title, input.notes ?? null, {
		fail: opts.graphFail ?? "throw",
	});
	return task;
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
	opts: TaskWriteOpts = {},
): Promise<void> {
	// due_time may only be set alongside a due_date (DB check constraint).
	// UpdateTaskSchema is `.partial()`, so a patch that nulls due_date while
	// leaving due_time untouched (or stale) can't be caught by Zod — it only
	// becomes invalid once merged into the row it's patching. Coerce rather
	// than reject: clearing the date silently clears whatever time no longer
	// has a date to sit on, whether or not the caller also touched due_time.
	const nextPatch = patch.due_date === null ? { ...patch, due_time: null } : patch;
	unwrap(await sb.from("tasks").update(nextPatch).eq("id", id));

	// Mentions only re-derive when text moves (not complete/star/domain).
	if ("title" in nextPatch || "notes" in nextPatch) {
		const titleIn = "title" in nextPatch;
		const notesIn = "notes" in nextPatch;
		if (titleIn && notesIn) {
			await syncTaskMentionsFromText(
				sb,
				id,
				nextPatch.title as string,
				nextPatch.notes as string | null,
				{ fail: opts.graphFail ?? "throw" },
			);
		} else {
			const row = await getTask(sb, id);
			if (row) {
				await syncTaskMentionsFromText(
					sb,
					id,
					titleIn ? (nextPatch.title as string) : row.title,
					notesIn ? (nextPatch.notes as string | null) : row.notes,
					{ fail: opts.graphFail ?? "throw" },
				);
			}
		}
	}
}

/**
 * Complete a task. Recurring tasks don't close — the due date rolls forward
 * to the next occurrence (reference semantics: an overdue weekly task rolls
 * from today, never into the past).
 *
 * The write is preconditioned on the occurrence the caller was looking at
 * (docs/adr/0037): the roll is the one non-idempotent write in the app, and a
 * replay — a stale render, a second tab — would advance the due date another
 * whole interval. `observed.dueDate` is what the clicked row showed; if the
 * row has moved on since, nothing is written and `applied` comes back false.
 */
export async function completeTask(
	sb: SupabaseClient,
	id: string,
	todayIso: string,
	observed: { dueDate: string | null },
): Promise<{ rolled: boolean; nextDue: string | null; applied: boolean }> {
	const task = await getTaskHot(sb, id);
	if (!task) throw new Error("Task not found");

	const nowIso = nowUtc();
	const next = nextCompleteFields(task, { todayIso, nowIso });
	if (next.rolled) {
		const due = next.due_date;
		// A recurring task may legitimately have no due date at all
		// (nextDueDate accepts a null currentDue), and `= NULL` matches nothing
		// in Postgres — the null case has to go through `is`, not `eq`.
		const q = sb.from("tasks").update({ due_date: due }).eq("id", id);
		const rows = unwrap(
			await (observed.dueDate === null
				? q.is("due_date", null)
				: q.eq("due_date", observed.dueDate)
			).select("id"),
		);
		return { rolled: true, nextDue: due, applied: (rows ?? []).length > 0 };
	}

	// Guarding on status=open makes a replayed close a no-op rather than a
	// second write of completed_at, which would reshuffle "Recently done".
	const rows = unwrap(
		await sb
			.from("tasks")
			.update({ status: "done", completed_at: next.completed_at })
			.eq("id", id)
			.eq("status", "open")
			.select("id"),
	);
	return { rolled: false, nextDue: null, applied: (rows ?? []).length > 0 };
}

export async function reopenTask(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("tasks").update({ status: "open", completed_at: null }).eq("id", id));
}

export async function deleteTask(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("tasks").delete().eq("id", id));
}

/**
 * Star / unstar a task as one of a given day's top 3.
 *
 * Desired state, not a flip (docs/adr/0037). Starring is idempotent by
 * construction. Unstarring guards on the day it is clearing, which is what
 * keeps Today's day navigation honest: unstarring while reading tomorrow can
 * no longer clear today's star.
 */
export async function setTop3(
	sb: SupabaseClient,
	id: string,
	opts: { forDateIso: string; starred: boolean },
): Promise<{ applied: boolean }> {
	const rows = unwrap(
		await (opts.starred
			? sb.from("tasks").update({ top3_for_date: opts.forDateIso }).eq("id", id)
			: sb
					.from("tasks")
					.update({ top3_for_date: null })
					.eq("id", id)
					.eq("top3_for_date", opts.forDateIso)
		).select("id"),
	);
	return { applied: (rows ?? []).length > 0 };
}

/**
 * Give a task a domain — the one way out of the inbox, and still one-way
 * (docs/adr/0024 §3, carried into docs/adr/0027). Un-filing would mean writing
 * NULL back, and no write path does: this signature takes a domain id, and
 * `updateTask`'s patch types `domain_id` as a plain string, so "leave it alone"
 * is the only thing an empty domain field can mean. That is now structural
 * rather than a runtime guard.
 */
export async function assignDomain(
	sb: SupabaseClient,
	id: string,
	domainId: string,
): Promise<void> {
	unwrap(await sb.from("tasks").update({ domain_id: domainId }).eq("id", id));
}
