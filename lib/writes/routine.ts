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
import {
	type CreateRoutineFormInput,
	createRoutineForm,
	type RoutineWithHistory,
	type UpdateRoutineFormInput,
	updateRoutineForm,
} from "@/lib/schemas/routine";
import type { RoutineIntent } from "@/lib/store/kinds/routine";
import { type Write, write } from "@/lib/store/write";

const UPDATE_ERROR = "Couldn't update routine.";
const SAVE_ERROR = "Couldn't save routine.";

/**
 * The row the list shows while the server writes it. A rejected field drops
 * it again; a confirmed one swaps it for the server's row (#29).
 */
function optimisticRoutine(input: CreateRoutineFormInput): RoutineWithHistory {
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: input.name,
		description: input.description ?? null,
		position: input.position ?? 0,
		active: true,
		time_of_day: input.time_of_day ?? "anytime",
		specific_time: input.specific_time ?? null,
		reminder_enabled: input.reminder_enabled ?? false,
		last_reminder_sent_date: null,
		goal_days: input.goal_days ?? null,
		archived_at: null,
		created_at: at,
		updated_at: at,
		completions: [],
	};
}

/** The fields an edit form changes that the routine kind patches, as its intent applies them. */
function routinePatch(input: UpdateRoutineFormInput) {
	return {
		...(input.name !== undefined ? { name: input.name } : {}),
		...(input.time_of_day !== undefined ? { time_of_day: input.time_of_day } : {}),
	};
}

/** The intent that shows nothing (docs/adr/0087): an empty edit on a row no view holds, or on this one. */
function unshownRoutine(id: string = crypto.randomUUID()): RoutineIntent {
	return { type: "edit", id, patch: {} };
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
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	create: (form: FormData): Write<"routine"> => {
		const input = createRoutineForm.read(form);
		return write(
			"routine",
			input ? { type: "create", routine: optimisticRoutine(input) } : unshownRoutine(),
			() => createRoutineAction(form),
		);
	},
	update: (id: string, form: FormData): Write<"routine"> => {
		const input = updateRoutineForm.read(form);
		return write(
			"routine",
			input ? { type: "edit", id, patch: routinePatch(input) } : unshownRoutine(id),
			() => updateRoutineAction(id, form),
			SAVE_ERROR,
		);
	},
	/** Archive has no intent of its own: the row leaves the list when the server's row confirms. */
	archive: (id: string, archived: boolean): Write<"routine"> =>
		write(
			"routine",
			{ type: "edit", id, patch: {} },
			() => archiveRoutineAction(id, archived),
			undefined,
			archived ? "Routine archived" : "Routine restored",
		),
	remove: (id: string): Write<"routine"> =>
		write("routine", { type: "delete", id }, () => deleteRoutineAction(id), UPDATE_ERROR),
};
