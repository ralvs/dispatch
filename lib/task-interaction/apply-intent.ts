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
	| { type: "complete"; id: string; observedDueDate: string | null }
	| { type: "reopen"; id: string }
	| { type: "setTop3"; id: string; starred: boolean; forDateIso: string }
	| { type: "delete"; id: string }
	| { type: "create"; task: TaskRow }
	| { type: "edit"; id: string }
	| { type: "assign"; id: string; domainId: string };

/**
 * What completing a task writes.
 *
 * Every completion closes its row, recurring included (docs/adr/0059). A
 * recurring row additionally hands back `spawn` — the due date of the next
 * occurrence, which the server materialises as a NEW row. The completed row
 * keeps its history (title, notes, completed_at, the day it was starred for)
 * and gives up its rule: `recurrence_rule` moves to the spawned row, so
 * re-opening and re-ticking the old occurrence can never spawn a second one.
 */
export type CompleteProjection = {
	completed_at: string;
	/** Non-null only for a recurring row: the next occurrence to create. */
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

/**
 * One row after an intent: undefined when the intent deletes it, the same
 * reference when the intent changes nothing on it — another row's intent, a
 * create, an edit, or a replay the row already reflects. That last case is
 * what makes a second tick on a ticked row a no-op, like the server's
 * `status = open` guard (completeTask).
 *
 * A recurring close does not project its successor: that is a server-made row
 * with a server-made id, and it arrives with the confirmed write.
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
			return {
				...row,
				status: "done",
				completed_at: fields.completed_at,
				// The rule leaves with the spawned occurrence.
				recurrence_rule: fields.spawn ? null : row.recurrence_rule,
			};
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
