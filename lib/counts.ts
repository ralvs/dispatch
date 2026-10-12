// What one row adds to each counter, in one place (docs/adr/0085). Client-safe:
// the server readers sum it over the rows they read, and the entity store's
// adapters take the difference a write makes to one row, so a seed and a tick
// cannot drift on what a counter counts. Extends the shape of lib/quiet.ts.
//
// A counter is named by its store key (lib/store/types.ts `AggregateKey`).
// `Counts` holds only what a row adds; a key it leaves out adds zero.

import { isQuiet } from "@/lib/quiet";
import type { NoteListRow } from "@/lib/schemas/note";
import type { TaskRow } from "@/lib/schemas/task";
import type { ProjectTaskCounts } from "@/lib/services/projects-shared";
import { isOverdue } from "@/lib/task-predicates";

export type CounterKey =
	/** Today's counters (#26): open work, quiet tasks left out. */
	| "tasks.open"
	| "tasks.overdue"
	/** Open work with no domain. */
	| "tasks.inbox"
	/** Open work filed under one domain — /domains' "N open tasks". */
	| `domain.open:${string}`
	/** Every task tagged to one project, quiet or not — /projects and Today's rings. */
	| `project.open:${string}`
	| `project.done:${string}`
	/** Notes the parser could not place. */
	| "notes.needsReview";

export type Counts = Partial<Record<CounterKey, number>>;

/** What open work depends on besides the row: the day, and which projects are quiet. */
export type CountCtx = { todayIso: string; quietProjectIds: ReadonlySet<string> };

/** The task fields the counters read. */
export type CountedTask = Pick<TaskRow, "status" | "due_date" | "project_id" | "domain_id">;

const NONE: Counts = {};

/**
 * Open work: Today's open, overdue and inbox counters, and the open count of
 * the task's domain. A quiet task (lib/quiet.ts) is not work you are carrying,
 * so it adds nothing here.
 */
export function openWorkCounts(task: CountedTask | undefined, ctx: CountCtx): Counts {
	if (task?.status !== "open" || isQuiet(task, ctx.quietProjectIds)) return NONE;
	const out: Counts = { "tasks.open": 1 };
	if (isOverdue(task, ctx.todayIso)) out["tasks.overdue"] = 1;
	if (task.domain_id === null) out["tasks.inbox"] = 1;
	else out[`domain.open:${task.domain_id}`] = 1;
	return out;
}

/**
 * A project's done and open counts. Nothing is left out: a quiet task is quiet
 * only on Today and the default /tasks views, and a project shows itself whole.
 */
export function projectCounts(task: Pick<TaskRow, "status" | "project_id"> | undefined): Counts {
	if (task?.project_id == null) return NONE;
	return { [`project.${task.status}:${task.project_id}`]: 1 };
}

/** Everything one task adds: what the store's task adapter moves. */
export function taskCounts(task: CountedTask | undefined, ctx: CountCtx): Counts {
	return plus(openWorkCounts(task, ctx), projectCounts(task));
}

/** A note adds to the review count while the parser's flag is on it. */
export function noteCounts(note: Pick<NoteListRow, "needs_review"> | undefined): Counts {
	return note?.needs_review ? { "notes.needsReview": 1 } : NONE;
}

/**
 * A routine is done on a day when it has a completion that day. The routines
 * view holds every routine with its completions, so this counter is counted
 * from the rows on both sides and never travels as an aggregate.
 */
export function isRoutineDoneOn(completions: readonly string[], dayIso: string): boolean {
	return completions.includes(dayIso);
}

/** How many of `routines` are done on `dayIso`. */
export function routinesDoneOn(
	routines: readonly { completions: readonly string[] }[],
	dayIso: string,
): number {
	return routines.filter((r) => isRoutineDoneOn(r.completions, dayIso)).length;
}

// ─── Arithmetic ─────────────────────────────────────────────────────────

/** `a` and `b` added; a key that sums to zero is dropped. */
export function plus(a: Counts, b: Counts): Counts {
	if (b === NONE) return a;
	if (a === NONE) return b;
	const out: Counts = { ...a };
	for (const [key, n] of entries(b)) {
		const next = (out[key] ?? 0) + n;
		if (next === 0) delete out[key];
		else out[key] = next;
	}
	return out;
}

/** What every row adds, summed: a server reader's count. */
export function tally<R>(rows: Iterable<R>, countsOf: (row: R) => Counts): Counts {
	let out: Counts = NONE;
	for (const row of rows) out = plus(out, countsOf(row));
	return out;
}

/** What a change from `before` to `after` moves: a write's deltas. Zeros dropped. */
export function change(before: Counts, after: Counts): Counts {
	return plus(after, negate(before));
}

/** One counter's value; zero when nothing added to it. */
export function countOf(counts: Counts, key: CounterKey): number {
	return counts[key] ?? 0;
}

function negate(counts: Counts): Counts {
	const out: Counts = {};
	for (const [key, n] of entries(counts)) out[key] = -n;
	return out;
}

function entries(counts: Counts): [CounterKey, number][] {
	return Object.entries(counts) as [CounterKey, number][];
}

// ─── Per id ─────────────────────────────────────────────────────────────

/** done/open per project, counted from `tasks`; a project with no task is absent. */
export function countByProject(
	tasks: Iterable<Pick<TaskRow, "status" | "project_id">>,
): Record<string, ProjectTaskCounts> {
	const out: Record<string, ProjectTaskCounts> = {};
	for (const [key, n] of entries(tally(tasks, projectCounts))) {
		const match = /^project\.(open|done):(.+)$/.exec(key);
		if (!match) continue;
		const [, bucket, projectId] = match;
		out[projectId] ??= { done: 0, open: 0 };
		out[projectId][bucket as keyof ProjectTaskCounts] = n;
	}
	return out;
}

/**
 * Projects' two counters as a seed carries them: both named, zero
 * included, since a counter moves only once a seed has started it.
 */
export function projectCounters(byProject: Readonly<Record<string, ProjectTaskCounts>>): Counts {
	const out: Counts = {};
	for (const [projectId, counts] of Object.entries(byProject)) {
		out[`project.done:${projectId}`] = counts.done;
		out[`project.open:${projectId}`] = counts.open;
	}
	return out;
}
