// The person page's writes (docs/adr/0077): the person, their facts and their
// interactions. Each builder makes the intent and its server call from the
// same arguments. Client-safe — server-action references only.

import { instantFromLocal, nowUtc } from "@/lib/dates";
import {
	type PersonFactRow,
	PersonFactTypeSchema,
	type PersonInteractionRow,
	PersonInteractionTypeSchema,
	type PersonRow,
	RelationshipTypeSchema,
} from "@/lib/schemas/person";
import { type Write, write } from "@/lib/store/write";
import {
	createFactAction,
	createInteractionAction,
	deleteFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";

/** A text field as the server will store it: blank clears it (lib/form-decode.ts). */
function textField(formData: FormData, key: string): string | null {
	const value = String(formData.get(key) ?? "").trim();
	return value === "" ? null : value;
}

/** What an edit asks for, so the page shows it while the server writes it. */
function personPatch(formData: FormData): Partial<PersonRow> {
	const relationship = RelationshipTypeSchema.safeParse(formData.get("relationship_type"));
	const name = textField(formData, "name");
	return {
		...(name ? { name } : {}),
		relationship_type: relationship.success ? relationship.data : null,
		company: textField(formData, "company"),
		email: textField(formData, "email"),
		phone: textField(formData, "phone"),
		notes: textField(formData, "notes"),
	};
}

/** The fact the list shows while the server writes it; the server's row replaces it. */
function optimisticFact(personId: string, formData: FormData): PersonFactRow {
	const type = PersonFactTypeSchema.safeParse(formData.get("fact_type"));
	const date = textField(formData, "date_relevant");
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		fact_type: type.success ? type.data : "other",
		fact_value: textField(formData, "fact_value") ?? "",
		source_ref: null,
		date_relevant: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
		recurring: false,
		created_at: nowUtc(),
	};
}

/**
 * The interaction the list shows while the server writes it. Its time follows
 * the server's rule: the entered day and time in the app timezone, else now.
 */
function optimisticInteraction(
	personId: string,
	formData: FormData,
	tz: string,
): PersonInteractionRow {
	const type = PersonInteractionTypeSchema.safeParse(formData.get("interaction_type"));
	const date = textField(formData, "occurred_date");
	const time = textField(formData, "occurred_time") ?? "00:00";
	let occurredAt = nowUtc();
	if (date) {
		try {
			occurredAt = instantFromLocal(date, time, tz);
		} catch {
			// An unparseable entry: the server rejects it and the row rolls back.
		}
	}
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		interaction_type: type.success ? type.data : "other",
		notes: textField(formData, "notes"),
		occurred_at: occurredAt,
	};
}

export const personWrites = {
	update: (id: string, form: FormData): Write<"person"> =>
		write(
			"person",
			{ type: "patch", id, patch: personPatch(form) },
			() => updatePersonAction(id, form),
			"Couldn't save person.",
		),
	remove: (id: string): Write<"person"> =>
		write(
			"person",
			{ type: "delete", id },
			() => deletePersonAction(id),
			"Couldn't delete person.",
		),
};

export const personFactWrites = {
	create: (personId: string, form: FormData): Write<"personFact"> =>
		write(
			"personFact",
			{ type: "create", row: optimisticFact(personId, form) },
			() => createFactAction(personId, form),
			"Couldn't add fact.",
		),
	remove: (personId: string, id: string): Write<"personFact"> =>
		write(
			"personFact",
			{ type: "delete", id },
			() => deleteFactAction(personId, id),
			"Couldn't delete fact.",
		),
};

export const personInteractionWrites = {
	create: (personId: string, form: FormData, tz: string): Write<"personInteraction"> =>
		write(
			"personInteraction",
			{ type: "create", row: optimisticInteraction(personId, form, tz) },
			() => createInteractionAction(personId, form),
			"Couldn't add interaction.",
		),
	remove: (personId: string, id: string): Write<"personInteraction"> =>
		write(
			"personInteraction",
			{ type: "delete", id },
			() => deleteInteractionAction(personId, id),
			"Couldn't delete interaction.",
		),
};
