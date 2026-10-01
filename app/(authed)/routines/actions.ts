"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { shiftDay } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { BACKFILL_DAYS, ROUTINE_HISTORY_DAYS } from "@/lib/routine-stats";
import {
	CreateRoutineSchema,
	type RoutineWithHistory,
	UpdateRoutineSchema,
} from "@/lib/schemas/routine";
import {
	archiveRoutine,
	createRoutine,
	deleteRoutine,
	getRoutineWithHistory,
	setCompletion,
	updateRoutine,
} from "@/lib/services/routines";
import { todayForRequest } from "@/lib/services/settings";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the routine it wrote, with its completion log (#29),
// so the client's entity store confirms its optimistic intent from it instead
// of waiting on a page render. Failures that are not a form's field errors
// still throw; the store runner rolls back on a throw.

type RoutineWrite = StoreWrite<RoutineWithHistory>;

function revalidateRoutineViews() {
	afterMutation("routine.write");
}

/**
 * The routine as it stands after the write, with the same history window the
 * pages read. A routine that is gone comes back as a deleted id.
 */
async function writtenRoutine(
	sb: SupabaseClient,
	id: string,
	todayIso?: string,
): Promise<RoutineWrite> {
	const today = todayIso ?? (await todayForRequest(sb));
	const row = await getRoutineWithHistory(sb, id, shiftDay(today, -ROUTINE_HISTORY_DAYS));
	return row ? stampWrite([row]) : stampWrite([], [id]);
}

export async function createRoutineAction(formData: FormData): Promise<ActionResult<RoutineWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const routine = await createRoutine(sb, decodeForm(CreateRoutineSchema, formData));
		revalidateRoutineViews();
		// A new routine has no completions yet.
		return stampWrite([{ ...routine, completions: [] }]);
	});
}

/**
 * Toggle one day's completion. Omit `date` for today.
 *
 * docs/adr/0054: this used to derive the date from the server clock and never
 * trust the client with one. It now accepts a date and bounds it here instead
 * — a real calendar date, not in the future, and no older than the 30 squares
 * the row already draws. The client picks which visible square to tick; it
 * cannot invent a day the UI is not showing.
 */
export async function toggleCompletionAction(
	routineId: string,
	currentlyDone: boolean,
	date?: string,
): Promise<ActionResult<RoutineWrite>> {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(routineId);
	const todayIso = await todayForRequest(sb);
	const requested = date === undefined ? todayIso : z.iso.date().parse(date);
	if (requested > todayIso || requested < shiftDay(todayIso, -(BACKFILL_DAYS - 1))) {
		throw new Error("Completion date is outside the 30-day window.");
	}
	await setCompletion(sb, id, requested, !currentlyDone);
	revalidateRoutineViews();
	return { ok: true, data: await writtenRoutine(sb, id, todayIso) };
}

/**
 * Rename a routine, or change its time of day. Without this a typo in a name
 * cost the streak, because Delete was the only way to be rid of it and Delete
 * takes the completion history with it (shape plan §07).
 */
export async function updateRoutineAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<RoutineWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const routineId = z.uuid().parse(id);
		await updateRoutine(sb, routineId, decodeForm(UpdateRoutineSchema, formData));
		revalidateRoutineViews();
		return writtenRoutine(sb, routineId);
	});
}

/** An archived routine comes back with `archived_at` set, and leaves every list. */
export async function archiveRoutineAction(
	id: string,
	archived: boolean,
): Promise<ActionResult<RoutineWrite>> {
	const { sb } = await requireOwnerPage();
	const routineId = z.uuid().parse(id);
	await archiveRoutine(sb, routineId, archived);
	revalidateRoutineViews();
	return { ok: true, data: await writtenRoutine(sb, routineId) };
}

export async function deleteRoutineAction(id: string): Promise<ActionResult<RoutineWrite>> {
	const { sb } = await requireOwnerPage();
	const routineId = z.uuid().parse(id);
	await deleteRoutine(sb, routineId);
	revalidateRoutineViews();
	return { ok: true, data: stampWrite([], [routineId]) };
}
