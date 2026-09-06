"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { shiftDay } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { BACKFILL_DAYS } from "@/lib/routine-stats";
import { CreateRoutineSchema, UpdateRoutineSchema } from "@/lib/schemas/routine";
import {
	archiveRoutine,
	createRoutine,
	deleteRoutine,
	setCompletion,
	updateRoutine,
} from "@/lib/services/routines";
import { todayForRequest } from "@/lib/services/settings";

function revalidateRoutineViews() {
	afterMutation("routine.write");
}

export async function createRoutineAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateRoutineSchema, formData);
	await createRoutine(sb, parsed);
	revalidateRoutineViews();
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
) {
	const { sb } = await requireOwnerPage();
	const todayIso = await todayForRequest(sb);
	const requested = date === undefined ? todayIso : z.iso.date().parse(date);
	if (requested > todayIso || requested < shiftDay(todayIso, -(BACKFILL_DAYS - 1))) {
		throw new Error("Completion date is outside the 30-day window.");
	}
	await setCompletion(sb, z.uuid().parse(routineId), requested, !currentlyDone);
	revalidateRoutineViews();
}

/**
 * Rename a routine, or change its time of day. Without this a typo in a name
 * cost the streak, because Delete was the only way to be rid of it and Delete
 * takes the completion history with it (shape plan §07).
 */
export async function updateRoutineAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(UpdateRoutineSchema, formData);
	await updateRoutine(sb, z.uuid().parse(id), parsed);
	revalidateRoutineViews();
}

export async function archiveRoutineAction(id: string, archived: boolean) {
	const { sb } = await requireOwnerPage();
	await archiveRoutine(sb, z.uuid().parse(id), archived);
	revalidateRoutineViews();
}

export async function deleteRoutineAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteRoutine(sb, z.uuid().parse(id));
	revalidateRoutineViews();
}
