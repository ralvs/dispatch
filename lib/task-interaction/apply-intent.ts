// What a task intent does to one row. Where the row then sits — which list,
// which band of the day — is the task adapter's business
// (lib/store/kinds/task.ts). Client-safe: the server's completeTask reads
// nextCompleteFields from here too, so the two cannot disagree on a close.
import { isRecurrenceRule, nextOccurrence } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/schemas/task";

/**
 * Optimistic + write payload — one contract for the store and the action.
 *
 * `edit` projects nothing: a form edit waits for the server, and the intent
 * exists so the entity store has a pending write to confirm the returned row
 * into. `assign` files an inbox task under a domain (docs/adr/0027).
 */
export type TaskIntent =
	| {
			type: "complete";
			id: string;
			observedDueDate: string | null;
			/**
			 * The id a recurring tick's done snapshot takes (docs/adr/0083). The
			 * row taps send one so the snapshot shows before the server answers;
			 * without it, the snapshot arrives with the confirmed write.
			 */
			snapshotId?: string;
	  }
	| { type: "skip"; id: string; observedDueDate: string | null }
	| { type: "reopen"; id: string }
	| { type: "setTop3"; id: string; starred: boolean; forDateIso: string }
	| { type: "delete"; id: string }
	| { type: "create"; task: TaskRow }
	| { type: "edit"; id: string }
	| { type: "assign"; id: string; domainId: string };

/**
 * What completing a task writes.
 *
 * A plain task closes. A recurring task stays open on one permanent row
 * (docs/adr/0083): `spawn` is the next cycle the row moves to, and the cycle
 * it leaves is saved as a done snapshot. Skipping a cycle moves the row the
 * same way, with no snapshot.
 */
export type CompleteProjection = {
	completed_at: string;
	/** Non-null only for a recurring row: the next cycle it moves to. */
	spawn: { due_date: string | null; recurrence_day: number | null } | null;
};

/** The one complete projector, shared by the client's tick and the server's close. */
export function nextCompleteFields(
	task: {
		recurrence_rule: string | null;
		due_date: string | null;
		recurrence_day: number | null;
	},
	ctx: { todayIso: string; nowIso?: string },
): CompleteProjection {
	const completed_at = ctx.nowIso ?? new Date().toISOString();
	// isRecurrenceRule, not isRecurrencePattern: a custom weekly rule must
	// spawn like any other. Guarding on the seven literals let an unknown rule
	// fall through to a plain close, silently ending the series (shape plan §06).
	if (!task.recurrence_rule || !isRecurrenceRule(task.recurrence_rule)) {
		return { completed_at, spawn: null };
	}
	const next = nextOccurrence({
		currentDue: task.due_date,
		rule: task.recurrence_rule,
		todayIso: ctx.todayIso,
		recurrenceDay: task.recurrence_day,
	});
	return { completed_at, spawn: { due_date: next.dueDate, recurrence_day: next.recurrenceDay } };
}

/** The recurring row on its next cycle; its star, if any, follows it there. */
function moveToNextCycle(
	row: TaskRow,
	next: { due_date: string | null; recurrence_day: number | null },
): TaskRow {
	return {
		...row,
		due_date: next.due_date,
		due_time: next.due_date === null ? null : row.due_time,
		recurrence_day: next.recurrence_day,
		top3_for_date: row.top3_for_date === null ? null : next.due_date,
	};
}

/**
 * Whether a tick or a skip still lands: the row is open and on the cycle the
 * click saw, as the server's gate checks (docs/adr/0037). A replay, or a
 * second tick before the first answers, finds the row already moved.
 */
function landsOn(row: TaskRow, observedDueDate: string | null): boolean {
	return row.status === "open" && row.due_date === observedDueDate;
}

/**
 * One row after an intent: undefined when the intent deletes it, the same
 * reference when the intent changes nothing on it — another row's intent, a
 * create, an edit, or a replay the row already reflects. That last case is
 * what makes a second tick on a ticked row a no-op, like the server's gate
 * (completeTask).
 *
 * A recurring tick moves the row and keeps it open. Its done snapshot is a
 * second row: `snapshotOf` projects it.
 */
export function projectTask(
	row: TaskRow,
	intent: TaskIntent,
	ctx: { todayIso: string; nowIso: string },
): TaskRow | undefined {
	if (intent.type === "create" || intent.type === "edit" || row.id !== intent.id) return row;
	switch (intent.type) {
		case "complete": {
			if (row.status !== "open") return row;
			const fields = nextCompleteFields(row, ctx);
			if (!fields.spawn) return { ...row, status: "done", completed_at: fields.completed_at };
			// A recurring row stays open, so its due date is what makes a stale
			// second tick a no-op.
			return landsOn(row, intent.observedDueDate) ? moveToNextCycle(row, fields.spawn) : row;
		}
		case "skip": {
			if (!landsOn(row, intent.observedDueDate)) return row;
			const next = nextCompleteFields(row, ctx).spawn;
			return next ? moveToNextCycle(row, next) : row;
		}
		case "reopen":
			return row.status === "open" ? row : { ...row, status: "open", completed_at: null };
		case "setTop3":
			// Desired state, matching setTop3 on the server (docs/adr/0037): an
			// unstar clears only the day it names.
			if (intent.starred) {
				return row.top3_for_date === intent.forDateIso
					? row
					: { ...row, top3_for_date: intent.forDateIso };
			}
			return row.top3_for_date === intent.forDateIso ? { ...row, top3_for_date: null } : row;
		case "assign":
			// The domain join is left for the server's row to fill in.
			return row.domain_id === intent.domainId ? row : { ...row, domain_id: intent.domainId };
		case "delete":
			return undefined;
	}
}

/**
 * The done snapshot a recurring tick saves (docs/adr/0083), as the server
 * will write it: the row's text and star on the cycle it fulfilled, no rule,
 * linked to the row. Undefined for any other intent, a plain task, a tick
 * that will not land, or a tick that named no snapshot id.
 */
export function snapshotOf(
	row: TaskRow,
	intent: TaskIntent,
	ctx: { todayIso: string; nowIso: string },
): TaskRow | undefined {
	if (intent.type !== "complete" || row.id !== intent.id || !intent.snapshotId) return undefined;
	if (!landsOn(row, intent.observedDueDate)) return undefined;
	const fields = nextCompleteFields(row, ctx);
	if (!fields.spawn) return undefined;
	return {
		...row,
		id: intent.snapshotId,
		status: "done",
		completed_at: fields.completed_at,
		recurrence_rule: null,
		series_id: row.id,
		created_at: fields.completed_at,
	};
}
