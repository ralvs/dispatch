"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { CreateRoutineSchema } from "@/lib/schemas/routine";
import {
	archiveRoutine,
	createRoutine,
	deleteRoutine,
	setCompletion,
} from "@/lib/services/routines";
import { getAppTimezone } from "@/lib/services/settings";

function revalidateRoutineViews() {
	revalidatePath("/routines");
	// The Today rail renders routine state too (docs: Briefing redesign).
	revalidatePath("/today");
}

export async function createRoutineAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const timeOfDay = formData.get("time_of_day");
	const parsed = CreateRoutineSchema.parse({
		name: formData.get("name"),
		time_of_day: typeof timeOfDay === "string" && timeOfDay ? timeOfDay : undefined,
	});
	await createRoutine(sb, parsed);
	revalidateRoutineViews();
}

/** Toggles today's completion. The date is derived server-side, never trusted from the client. */
export async function toggleCompletionAction(routineId: string, currentlyDone: boolean) {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	await setCompletion(sb, z.uuid().parse(routineId), todayInTz(tz), !currentlyDone);
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
