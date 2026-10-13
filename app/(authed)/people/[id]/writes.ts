// The person page's writes (docs/adr/0077): the person, their facts and their
// interactions. Each builder makes the intent and its server call from the
// same arguments. Client-safe — server-action references only.

import { nowUtc } from "@/lib/dates";
import {
	type CreatePersonFactFormInput,
	type CreatePersonInteractionFormInput,
	createPersonFactForm,
	createPersonInteractionForm,
	interactionOccurredAt,
	type PersonFactRow,
	type PersonInteractionRow,
	type PersonRow,
	updatePersonForm,
} from "@/lib/schemas/person";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import {
	createFactAction,
	createInteractionAction,
	deleteFactAction,
	deleteInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";

/** The fact the list shows while the server writes it; the server's row replaces it. */
function optimisticFact(personId: string, input: CreatePersonFactFormInput): PersonFactRow {
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		fact_type: input.fact_type,
		fact_value: input.fact_value,
		source_ref: input.source_ref ?? null,
		date_relevant: input.date_relevant ?? null,
		recurring: input.recurring ?? false,
		created_at: nowUtc(),
	};
}

/** The interaction the list shows while the server writes it; no day entered means now. */
function optimisticInteraction(
	personId: string,
	input: CreatePersonInteractionFormInput,
): PersonInteractionRow {
	return {
		id: crypto.randomUUID(),
		person_id: personId,
		interaction_type: input.interaction_type,
		notes: input.notes ?? null,
		occurred_at: input.occurred_at ?? nowUtc(),
	};
}

/** The interaction form as the server reads it; null when it refuses the form or the day and time. */
function readInteraction(form: FormData, tz: string): CreatePersonInteractionFormInput | null {
	let occurredAt: string | null;
	try {
		occurredAt = interactionOccurredAt(form, tz);
	} catch {
		return null;
	}
	return createPersonInteractionForm.read(form, { occurred_at: occurredAt });
}

export const personWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	update: (id: string, form: FormData): Write<"person"> => {
		const input = updatePersonForm.read(form);
		const patch: Partial<PersonRow> | null = input;
		return write(
			"person",
			patch ? { type: "patch", id, patch } : unshown(id),
			() => updatePersonAction(id, form),
			"Couldn't save person.",
		);
	},
	remove: (id: string): Write<"person"> =>
		write(
			"person",
			{ type: "delete", id },
			() => deletePersonAction(id),
			"Couldn't delete person.",
		),
};

export const personFactWrites = {
	create: (personId: string, form: FormData): Write<"personFact"> => {
		const input = createPersonFactForm.read(form);
		return write(
			"personFact",
			input ? { type: "create", row: optimisticFact(personId, input) } : unshown(),
			() => createFactAction(personId, form),
			"Couldn't add fact.",
		);
	},
	remove: (personId: string, id: string): Write<"personFact"> =>
		write(
			"personFact",
			{ type: "delete", id },
			() => deleteFactAction(personId, id),
			"Couldn't delete fact.",
		),
};

export const personInteractionWrites = {
	create: (personId: string, form: FormData, tz: string): Write<"personInteraction"> => {
		const input = readInteraction(form, tz);
		return write(
			"personInteraction",
			input ? { type: "create", row: optimisticInteraction(personId, input) } : unshown(),
			() => createInteractionAction(personId, form),
			"Couldn't add interaction.",
		);
	},
	remove: (personId: string, id: string): Write<"personInteraction"> =>
		write(
			"personInteraction",
			{ type: "delete", id },
			() => deleteInteractionAction(personId, id),
			"Couldn't delete interaction.",
		),
};
