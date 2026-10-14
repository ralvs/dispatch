import "server-only";
import type { Database } from "@/lib/database";
import { dayWindowUtc, nowUtc } from "@/lib/dates";
import { escapeLike } from "@/lib/like";
import { notQuietFilter } from "@/lib/quiet";
import {
	TASK_HOT_SELECT,
	TASK_NOTES_MAX,
	TASK_SELECT,
	type TaskHotRow,
	type TaskRow,
} from "@/lib/schemas/task";
import { AppendRefusedError, PartialWriteError, unwrap } from "@/lib/services/errors";
import { type GraphFail, syncTaskMentionsFromText } from "@/lib/services/mentions";
import { listQuietProjectIds } from "@/lib/services/quiet";
import type { SupabaseClient } from "@/lib/supabase/types";
import { nextCompleteFields } from "@/lib/task-interaction/apply-intent";

export type { TaskRow } from "@/lib/schemas/task";

export async function listTasks(
	sb: SupabaseClient,
	filters: {
		status?: "open" | "done";
		domainId?: string;
		/** Tasks with no domain at all — the inbox. Distinct from domainId. */
		unfiled?: boolean;
		projectId?: string;
		/** Due strictly before this date (`YYYY-MM-DD`); undated tasks drop out. */
		dueBefore?: string;
		/** At most this many rows. */
		limit?: number;
		/**
		 * Drop quiet tasks (lib/quiet.ts). Today asks for this; /tasks loads them
		 * and files them into their own view. `true` reads the quiet projects;
		 * a caller that already holds them passes the set.
		 */
		excludeQuiet?: boolean | ReadonlySet<string>;
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
	if (filters.dueBefore) q = q.lt("due_date", filters.dueBefore);
	if (filters.limit) q = q.limit(filters.limit);
	if (filters.excludeQuiet) {
		const quiet =
			filters.excludeQuiet === true ? await listQuietProjectIds(sb) : filters.excludeQuiet;
		const keep = notQuietFilter(quiet);
		if (keep) q = q.or(keep);
	}
	const data = unwrap(await q);
	return data ?? [];
}

/**
 * The /inbox queue: open tasks that were captured without a domain.
 *
 * Quiet tasks are excluded for consistency with Today and /tasks, though the
 * two narrows barely overlap: a task with no project is never quiet, so this
 * only ever drops an undated task that was tagged to a non-active project and
 * left unfiled.
 */
export async function listInboxTasks(sb: SupabaseClient): Promise<TaskRow[]> {
	return listTasks(sb, { status: "open", unfiled: true, excludeQuiet: true });
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
	return data ?? [];
}

/** Recently completed tasks only — Tasks page strip, not full history. */
export async function listRecentDone(sb: SupabaseClient, sinceUtc: string): Promise<TaskRow[]> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select(TASK_SELECT)
			.eq("status", "done")
			.gte("completed_at", sinceUtc)
			.order("completed_at", { ascending: false, nullsFirst: false }),
	);
	return data ?? [];
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
	return data ?? null;
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
	return data ?? [];
}

async function getTaskHot(sb: SupabaseClient, id: string): Promise<TaskHotRow | null> {
	const data = unwrap(await sb.from("tasks").select(TASK_HOT_SELECT).eq("id", id).maybeSingle());
	return data ?? null;
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
		source?: Database["public"]["Tables"]["tasks"]["Row"]["source"];
		reminder_offsets?: number[];
		top3_for_date?: string | null;
	},
	opts: TaskWriteOpts = {},
): Promise<TaskRow> {
	// due_time may only be set alongside a due_date (DB check constraint).
	// Every create (form, capture) funnels through here, so it can enforce the
	// invariant defensively — mirrors the coercion in updateTask below rather
	// than rejecting: a time with no date to sit on is silently dropped instead
	// of degrading the capture. A task in a project takes the project's domain
	// whatever `domain_id` says; the database holds that rule (docs/adr/0072).
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
	const task = data;
	// Text write owns the person graph — callers must not post-sync.
	await syncTaskMentionsFromText(sb, task.id, input.title, input.notes ?? null, {
		fail: opts.graphFail ?? "throw",
	});
	return task;
}

export type TaskPatch = Partial<{
	title: string;
	notes: string | null;
	due_date: string | null;
	due_time: string | null;
	priority: number;
	domain_id: string;
	project_id: string | null;
	recurrence_rule: string | null;
	/**
	 * A line added to the end of the notes, in one UPDATE
	 * (`task_notes_append`), so two appends at once both survive. Refused past
	 * TASK_NOTES_MAX. Not with `notes`.
	 */
	notes_append: string;
}>;

/**
 * Edit a task. A text write owns the person graph: when the title or notes
 * move, by a patch or an append, mentions re-derive once from the saved text.
 * Callers must not post-sync.
 *
 * An append runs first, so a refusal (AppendRefusedError) writes nothing. If
 * it lands and a later step fails, mentions are re-derived if they can be and
 * the error is a PartialWriteError: the row changed, and the caller still
 * owes its ledger row.
 */
export async function updateTask(
	sb: SupabaseClient,
	id: string,
	patch: TaskPatch,
	opts: TaskWriteOpts = {},
): Promise<void> {
	const { notes_append, ...fields } = patch;
	if (notes_append === undefined) return writeTaskFields(sb, id, fields, false, opts);
	if ("notes" in fields) throw new Error("A task edit sends notes or notes_append, not both.");
	const [appended] = unwrap(
		await sb.rpc("task_notes_append", {
			p_task_id: id,
			p_line: notes_append,
			p_max: TASK_NOTES_MAX,
		}),
	);
	if (!appended) {
		const exists = await getTask(sb, id);
		throw new AppendRefusedError(
			exists ? `Note would exceed ${TASK_NOTES_MAX} characters.` : "No task with that id.",
		);
	}
	try {
		await writeTaskFields(sb, id, fields, true, opts);
	} catch (err) {
		// The appended notes are saved: their mentions should be too.
		try {
			const row = await getTask(sb, id);
			if (row) await syncTaskMentionsFromText(sb, id, row.title, row.notes);
		} catch (syncErr) {
			console.error("[tasks] mention re-sync after a failed edit", syncErr);
		}
		throw new PartialWriteError(err);
	}
}

/** The column writes of an edit, then its one mention sync. */
async function writeTaskFields(
	sb: SupabaseClient,
	id: string,
	patch: Omit<TaskPatch, "notes_append">,
	appended: boolean,
	opts: TaskWriteOpts,
): Promise<void> {
	// due_time may only be set alongside a due_date (DB check constraint).
	// UpdateTaskSchema is `.partial()`, so a patch that nulls due_date while
	// leaving due_time untouched (or stale) can't be caught by Zod — it only
	// becomes invalid once merged into the row it's patching. Coerce rather
	// than reject: clearing the date silently clears whatever time no longer
	// has a date to sit on, whether or not the caller also touched due_time.
	const nextPatch = patch.due_date === null ? { ...patch, due_time: null } : patch;
	if (Object.keys(nextPatch).length > 0) {
		unwrap(await sb.from("tasks").update(nextPatch).eq("id", id));
	}

	// Mentions only re-derive when text moves (not complete/star/domain). An
	// append moved the notes in the database, so they are read back.
	if (appended || "title" in nextPatch || "notes" in nextPatch) {
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
 * Complete a task.
 *
 * A plain task closes. A recurring task stays one permanent row
 * (docs/adr/0083): the tick saves a done snapshot of this cycle and moves the
 * row to its next due date, in one database function, so a crash can never
 * move the date without saving the history. The row keeps its id, so links,
 * URLs and assistant references to it never go stale.
 *
 * Both paths keep ADR-0037's precondition on the cycle the caller was looking
 * at. `observed.dueDate` is what the clicked row showed; if the row has moved
 * on since, or is already done, nothing is written and `applied` comes back
 * false. A replay (second tab, stale render, double click) is then a no-op,
 * never a second snapshot.
 *
 * `snapshotId` names the snapshot the client already shows (docs/adr/0069).
 * `snapshot` is the row the tick saved, so the caller can hand it to the
 * entity store without a second read.
 */
export async function completeTask(
	sb: SupabaseClient,
	id: string,
	todayIso: string,
	observed: { dueDate: string | null },
	opts: { snapshotId?: string } = {},
): Promise<{
	applied: boolean;
	/** The recurring row's new due date; null for a plain task. */
	nextDue: string | null;
	/** The done snapshot a recurring tick saved; null for a plain task. */
	snapshot: TaskRow | null;
}> {
	const task = await getTaskHot(sb, id);
	// Gone already (deleted in another tab): nothing to close. Not an error —
	// the caller reports the row as gone and the client drops it.
	if (!task) return { applied: false, nextDue: null, snapshot: null };

	const next = nextCompleteFields(task, { todayIso, nowIso: nowUtc() });

	if (next.spawn) {
		const snapshotId = unwrap(
			await sb.rpc("complete_recurring_task", {
				p_task_id: id,
				p_observed_due: observed.dueDate,
				p_completed_at: next.completed_at,
				p_next_due: next.spawn.due_date,
				p_next_recurrence_day: next.spawn.recurrence_day,
				p_snapshot_id: opts.snapshotId ?? null,
			}),
		);
		if (!snapshotId) return { applied: false, nextDue: null, snapshot: null };
		// Mentions come from the text the snapshot saved, which the function
		// read under its lock. A lost mention re-derives on the next edit, and
		// the tick has landed (docs/adr/0030 keeps the graph text-owned).
		const snapshot = await getTask(sb, snapshotId);
		if (snapshot) {
			await syncTaskMentionsFromText(sb, snapshotId, snapshot.title, snapshot.notes, {
				fail: "swallow",
			});
		}
		return { applied: true, nextDue: next.spawn.due_date, snapshot };
	}

	// Guarding on status=open makes a replayed close a no-op rather than a
	// second write of completed_at, which would reshuffle "Recently done".
	// A null observed due date has to go through `is`, not `eq`: `= NULL`
	// matches nothing in Postgres.
	const close = sb
		.from("tasks")
		.update({ status: "done", completed_at: next.completed_at })
		.eq("id", id)
		.eq("status", "open");
	const closed = unwrap(
		await (observed.dueDate === null
			? close.is("due_date", null)
			: close.eq("due_date", observed.dueDate)
		).select("id"),
	);
	return { applied: (closed ?? []).length > 0, nextDue: null, snapshot: null };
}

/**
 * Skip one cycle of a recurring task: move it to its next due date and save
 * no snapshot (docs/adr/0083). Same precondition as a tick. A task that does
 * not repeat has no cycle to skip, and nothing is written.
 */
export async function skipTask(
	sb: SupabaseClient,
	id: string,
	todayIso: string,
	observed: { dueDate: string | null },
): Promise<{ applied: boolean; nextDue: string | null }> {
	const task = await getTaskHot(sb, id);
	if (!task) return { applied: false, nextDue: null };
	const next = nextCompleteFields(task, { todayIso }).spawn;
	if (!next) return { applied: false, nextDue: null };
	const moved = unwrap(
		await sb.rpc("skip_recurring_task", {
			p_task_id: id,
			p_observed_due: observed.dueDate,
			p_next_due: next.due_date,
			p_next_recurrence_day: next.recurrence_day,
		}),
	);
	return moved ? { applied: true, nextDue: next.due_date } : { applied: false, nextDue: null };
}

/**
 * Reopen a done task.
 *
 * The latest snapshot of a recurring task undoes its tick (docs/adr/0083):
 * the snapshot goes, and the recurring row moves back to that cycle.
 * `seriesId` is then that row, and the reopened id no longer exists. Any other
 * done row, an older snapshot included, simply reopens as a plain task.
 */
export async function reopenTask(
	sb: SupabaseClient,
	id: string,
): Promise<{ seriesId: string | null }> {
	const seriesId = unwrap(await sb.rpc("untick_recurring_snapshot", { p_snapshot_id: id })) as
		| string
		| null;
	if (seriesId) return { seriesId };
	unwrap(await sb.from("tasks").update({ status: "open", completed_at: null }).eq("id", id));
	return { seriesId: null };
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
