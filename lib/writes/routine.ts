// The routine kind's writes (docs/adr/0077): each builder makes the intent
// and its server call from the same arguments. Client-safe — server-action
// references only.

import {
	archiveRoutineAction,
	createRoutineAction,
	deleteRoutineAction,
	toggleCompletionAction,
	updateRoutineAction,
} from "@/lib/actions/routines";
import { nowUtc } from "@/lib/dates";
import { type RoutineWithHistory, TimeOfDayBucketSchema } from "@/lib/schemas/routine";
import { type Write, write } from "@/lib/store/write";

const UPDATE_ERROR = "Couldn't update routine.";
const SAVE_ERROR = "Couldn't save routine.";

/**
 * The row the list shows while the server writes it. A rejected field drops
 * it again; a confirmed one swaps it for the server's row (#29).
 */
function optimisticRoutine(formData: FormData): RoutineWithHistory {
	const at = nowUtc();
	const timeOfDay = TimeOfDayBucketSchema.safeParse(formData.get("time_of_day"));
	return {
		id: crypto.randomUUID(),
		name: String(formData.get("name") ?? "").trim() || "Untitled",
		description: null,
		position: 0,
		active: true,
		time_of_day: timeOfDay.success ? timeOfDay.data : "anytime",
		specific_time: null,
		reminder_enabled: false,
		last_reminder_sent_date: null,
		goal_days: null,
		archived_at: null,
		created_at: at,
		updated_at: at,
		completions: [],
	};
}

/** The fields an edit form changes, as the patch its intent applies. */
function routinePatch(formData: FormData) {
	const name = String(formData.get("name") ?? "").trim();
	const timeOfDay = TimeOfDayBucketSchema.safeParse(formData.get("time_of_day"));
	return {
		...(name ? { name } : {}),
		...(timeOfDay.success ? { time_of_day: timeOfDay.data } : {}),
	};
}

export const routineWrites = {
	/** Tick or untick one day. The server ticks the intent's own day (ADR-0054, ADR-0077). */
	toggle: (i: { id: string; date: string; done: boolean }): Write<"routine"> =>
		write(
			"routine",
			{ type: "toggle", ...i },
			() => toggleCompletionAction(i.id, !i.done, i.date),
			UPDATE_ERROR,
		),
	create: (form: FormData): Write<"routine"> =>
		write("routine", { type: "create", routine: optimisticRoutine(form) }, () =>
			createRoutineAction(form),
		),
	update: (id: string, form: FormData): Write<"routine"> =>
		write(
			"routine",
			{ type: "edit", id, patch: routinePatch(form) },
			() => updateRoutineAction(id, form),
			SAVE_ERROR,
		),
	/** Archive has no intent of its own: the row leaves the list when the server's row confirms. */
	archive: (id: string, archived: boolean): Write<"routine"> =>
		write("routine", { type: "edit", id, patch: {} }, () => archiveRoutineAction(id, archived)),
	remove: (id: string): Write<"routine"> =>
		write("routine", { type: "delete", id }, () => deleteRoutineAction(id), UPDATE_ERROR),
};
