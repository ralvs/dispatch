// The person kind's create (docs/adr/0077): the intent and its server call
// from the same arguments. Client-safe — server-action references only. The
// person page's own writes sit beside its actions ([id]/writes.ts).

import { nowUtc } from "@/lib/dates";
import { type PersonRow, RelationshipTypeSchema } from "@/lib/schemas/person";
import { type Write, write } from "@/lib/store/write";
import { createPersonAction } from "./actions";

/** The person the list shows while the server writes them; the server's row replaces it (#30). */
function optimisticPerson(formData: FormData): PersonRow {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const relationship = RelationshipTypeSchema.safeParse(formData.get("relationship_type"));
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		relationship_type: relationship.success ? relationship.data : null,
		email: text("email"),
		phone: text("phone"),
		company: text("company"),
		notes: null,
		created_at: at,
		updated_at: at,
	};
}

export const personListWrites = {
	create: (form: FormData): Write<"person"> =>
		write("person", { type: "create", row: optimisticPerson(form) }, () =>
			createPersonAction(form),
		),
};
