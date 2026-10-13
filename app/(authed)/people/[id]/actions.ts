"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/invalidate";
import {
	createPersonFactForm,
	createPersonInteractionForm,
	interactionOccurredAt,
	type PersonFactRow,
	type PersonInteractionRow,
	type PersonRow,
	updatePersonForm,
} from "@/lib/schemas/person";
import {
	createFact,
	createInteraction,
	deleteFact,
	deleteInteraction,
	deletePerson,
	updatePerson,
} from "@/lib/services/people";
import { getAppTimezone } from "@/lib/services/settings";
import { written } from "@/lib/services/written";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns what it wrote (#30), so the person page's entity-store
// views — the person, the facts, the interactions — confirm their optimistic
// intent from it instead of waiting on a page render. A form write returns a
// rejected field as a result (runFormAction); other failures throw, and the
// store runner rolls back on a throw.

function revalidatePersonViews() {
	afterMutation("people.write");
}

export async function updatePersonAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<StoreWrite<PersonRow>>> {
	const { sb } = await requireOwnerPage();
	const personId = z.uuid().parse(id);
	return runFormAction(formData, async () => {
		await updatePerson(sb, personId, updatePersonForm.parse(formData));
		revalidatePersonViews();
		return written(sb, "person", personId);
	});
}

/** No redirect: that would roll the intent back. The page navigates once the store has it. */
export async function deletePersonAction(id: string): Promise<ActionResult<StoreWrite<PersonRow>>> {
	const { sb } = await requireOwnerPage();
	const personId = z.uuid().parse(id);
	await deletePerson(sb, personId);
	afterMutation("people.write");
	return { ok: true, data: stampWrite([], [personId]) };
}

export async function createFactAction(
	personId: string,
	formData: FormData,
): Promise<ActionResult<StoreWrite<PersonFactRow>>> {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(personId);
	return runFormAction(formData, async () => {
		const fact = await createFact(sb, id, createPersonFactForm.parse(formData));
		revalidatePersonViews();
		return stampWrite([fact]);
	});
}

export async function deleteFactAction(
	personId: string,
	factId: string,
): Promise<ActionResult<StoreWrite<PersonFactRow>>> {
	const { sb } = await requireOwnerPage();
	z.uuid().parse(personId);
	const id = z.uuid().parse(factId);
	await deleteFact(sb, id);
	revalidatePersonViews();
	return { ok: true, data: stampWrite([], [id]) };
}

export async function createInteractionAction(
	personId: string,
	formData: FormData,
): Promise<ActionResult<StoreWrite<PersonInteractionRow>>> {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(personId);
	// A refused field comes back as a field error, not a throw (docs/adr/0087).
	return runFormAction(formData, async () => {
		const occurredAt = formData.get("occurred_date")
			? interactionOccurredAt(formData, await getAppTimezone(sb))
			: null;
		const parsed = createPersonInteractionForm.parse(formData, { occurred_at: occurredAt });
		const interaction = await createInteraction(sb, id, parsed);
		revalidatePersonViews();
		return stampWrite([interaction]);
	});
}

export async function deleteInteractionAction(
	personId: string,
	interactionId: string,
): Promise<ActionResult<StoreWrite<PersonInteractionRow>>> {
	const { sb } = await requireOwnerPage();
	z.uuid().parse(personId);
	const id = z.uuid().parse(interactionId);
	await deleteInteraction(sb, id);
	revalidatePersonViews();
	return { ok: true, data: stampWrite([], [id]) };
}
