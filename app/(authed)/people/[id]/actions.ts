"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { instantFromLocal } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import {
	CreatePersonFactSchema,
	CreatePersonInteractionSchema,
	UpdatePersonSchema,
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

function revalidatePersonViews(id: string) {
	afterMutation("people.write", { id });
}

export async function updatePersonAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const personId = z.uuid().parse(id);
	const parsed = decodeForm(UpdatePersonSchema, formData);
	await updatePerson(sb, personId, parsed);
	revalidatePersonViews(personId);
}

export async function deletePersonAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deletePerson(sb, z.uuid().parse(id));
	afterMutation("people.write");
	redirect("/people");
}

export async function createFactAction(personId: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(personId);
	const parsed = decodeForm(CreatePersonFactSchema, formData);
	await createFact(sb, id, parsed);
	revalidatePersonViews(id);
}

export async function deleteFactAction(personId: string, factId: string) {
	const { sb } = await requireOwnerPage();
	await deleteFact(sb, z.uuid().parse(factId));
	revalidatePersonViews(z.uuid().parse(personId));
}

export async function createInteractionAction(personId: string, formData: FormData) {
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
	await createInteraction(sb, id, parsed);
	revalidatePersonViews(id);
}

export async function deleteInteractionAction(personId: string, interactionId: string) {
	const { sb } = await requireOwnerPage();
	await deleteInteraction(sb, z.uuid().parse(interactionId));
	revalidatePersonViews(z.uuid().parse(personId));
}
