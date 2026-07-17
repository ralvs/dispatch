"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { CreatePersonSchema } from "@/lib/schemas/person";
import { createPerson, deletePerson } from "@/lib/services/people";

function revalidatePeopleViews() {
	revalidatePath("/people");
}

export async function createPersonAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreatePersonSchema, formData);
	await createPerson(sb, parsed);
	revalidatePeopleViews();
}

export async function deletePersonAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deletePerson(sb, z.uuid().parse(id));
	revalidatePeopleViews();
}
