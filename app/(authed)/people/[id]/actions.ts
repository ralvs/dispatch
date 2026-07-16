"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { instantFromLocal } from "@/lib/dates";
import {
	CreatePersonFactSchema,
	CreatePersonSchema,
	PersonInteractionTypeSchema,
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
	revalidatePath("/people");
	revalidatePath(`/people/${id}`);
}

export async function updatePersonAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const personId = z.uuid().parse(id);
	const parsed = CreatePersonSchema.partial().parse({
		name: formData.get("name") || undefined,
		relationship_type: formData.get("relationship_type") || null,
		email: formData.get("email") || null,
		phone: formData.get("phone") || null,
		company: formData.get("company") || null,
		notes: formData.get("notes") || null,
	});
	await updatePerson(sb, personId, parsed);
	revalidatePersonViews(personId);
}

export async function deletePersonAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deletePerson(sb, z.uuid().parse(id));
	revalidatePath("/people");
	redirect("/people");
}

export async function createFactAction(personId: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(personId);
	const parsed = CreatePersonFactSchema.parse({
		fact_type: formData.get("fact_type"),
		fact_value: formData.get("fact_value"),
		date_relevant: formData.get("date_relevant") || null,
	});
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
	await createInteraction(sb, id, {
		interaction_type: PersonInteractionTypeSchema.parse(formData.get("interaction_type")),
		notes: (formData.get("notes") as string) || null,
		occurred_at: occurredAt,
	});
	revalidatePersonViews(id);
}

export async function deleteInteractionAction(personId: string, interactionId: string) {
	const { sb } = await requireOwnerPage();
	await deleteInteraction(sb, z.uuid().parse(interactionId));
	revalidatePersonViews(z.uuid().parse(personId));
}
