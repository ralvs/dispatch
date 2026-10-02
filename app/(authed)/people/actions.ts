"use server";

import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/invalidate";
import { CreatePersonSchema, type PersonRow } from "@/lib/schemas/person";
import { createPerson } from "@/lib/services/people";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

/** Returns the person it wrote, for the entity store to confirm from (#30). */
export async function createPersonAction(
	formData: FormData,
): Promise<ActionResult<StoreWrite<PersonRow>>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const person = await createPerson(sb, decodeForm(CreatePersonSchema, formData));
		afterMutation("people.write");
		return stampWrite([person]);
	});
}
