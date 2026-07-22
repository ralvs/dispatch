"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateRoutineSchema } from "@/lib/schemas/routine";
import {
	archiveRoutine,
	createRoutine,
	deleteRoutine,
	setCompletion,
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

/** Toggles today's completion. The date is derived server-side, never trusted from the client. */
export async function toggleCompletionAction(routineId: string, currentlyDone: boolean) {
	const { sb } = await requireOwnerPage();
	await setCompletion(sb, z.uuid().parse(routineId), await todayForRequest(sb), !currentlyDone);
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
