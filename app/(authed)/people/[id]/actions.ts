"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { instantFromLocal } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/invalidate";
import {
	CreatePersonFactSchema,
	CreatePersonInteractionSchema,
	type PersonFactRow,
	type PersonInteractionRow,
	type PersonRow,
	UpdatePersonSchema,
} from "@/lib/schemas/person";
import {
	createFact,
	createInteraction,
	deleteFact,
	deleteInteraction,
	deletePerson,
	getPerson,
	updatePerson,
} from "@/lib/services/people";
import { getAppTimezone } from "@/lib/services/settings";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns what it wrote (#30), so the person page's entity-store
// views — the person, the facts, the interactions — confirm their optimistic
// intent from it instead of waiting on a page render. Failures throw; the
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
	const parsed = decodeForm(UpdatePersonSchema, formData);
	await updatePerson(sb, personId, parsed);
	revalidatePersonViews();
	const row = await getPerson(sb, personId);
	return { ok: true, data: row ? stampWrite([row]) : stampWrite([], [personId]) };
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
	const parsed = decodeForm(CreatePersonFactSchema, formData);
	const fact = await createFact(sb, id, parsed);
	revalidatePersonViews();
	return { ok: true, data: stampWrite([fact]) };
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
	const dateIso = formData.get("occurred_date");
	const time = formData.get("occurred_time");
	let occurredAt: string | null = null;
	if (typeof dateIso === "string" && dateIso) {
		const tz = await getAppTimezone(sb);
		occurredAt = instantFromLocal(dateIso, typeof time === "string" && time ? time : "00:00", tz);
	}
	const parsed = decodeForm(CreatePersonInteractionSchema, formData, {
		overrides: { occurred_at: occurredAt },
	});
	const interaction = await createInteraction(sb, id, parsed);
	revalidatePersonViews();
	return { ok: true, data: stampWrite([interaction]) };
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
