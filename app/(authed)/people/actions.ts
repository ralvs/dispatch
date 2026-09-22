"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreatePersonSchema } from "@/lib/schemas/person";
import { createPerson, deletePerson } from "@/lib/services/people";

function revalidatePeopleViews() {
	afterMutation("people.write");
}

export async function createPersonAction(formData: FormData): Promise<ActionResult> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		await createPerson(sb, decodeForm(CreatePersonSchema, formData));
		revalidatePeopleViews();
	});
}

export async function deletePersonAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deletePerson(sb, z.uuid().parse(id));
	revalidatePeopleViews();
}
