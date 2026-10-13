// The person kind's create (docs/adr/0077): the intent and its server call
// from the same arguments. Client-safe — server-action references only. The
// person page's own writes sit beside its actions ([id]/writes.ts).

import { nowUtc } from "@/lib/dates";
import { type CreatePersonFormInput, createPersonForm, type PersonRow } from "@/lib/schemas/person";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import { createPersonAction } from "./actions";

/** The person the list shows while the server writes them; the server's row replaces it (#30). */
function optimisticPerson(input: CreatePersonFormInput): PersonRow {
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: input.name,
		relationship_type: input.relationship_type ?? null,
		email: input.email ?? null,
		phone: input.phone ?? null,
		company: input.company ?? null,
		notes: input.notes ?? null,
		created_at: at,
		updated_at: at,
	};
}

export const personListWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	create: (form: FormData): Write<"person"> => {
		const input = createPersonForm.read(form);
		return write(
			"person",
			input ? { type: "create", row: optimisticPerson(input) } : unshown(),
			() => createPersonAction(form),
		);
	},
};
