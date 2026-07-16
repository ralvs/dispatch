import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
	PersonFactTypeSchema,
	PersonInteractionTypeSchema,
	RelationshipTypeSchema,
} from "@/lib/schemas/person";
import { unwrap } from "@/lib/services/errors";

// ─── People ─────────────────────────────────────────────────────────────

const PEOPLE_SELECT =
	"id, name, relationship_type, email, phone, company, notes, created_at, updated_at";

export type PersonRow = {
	id: string;
	name: string;
	relationship_type: z.infer<typeof RelationshipTypeSchema> | null;
	email: string | null;
	phone: string | null;
	company: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

export type CreatePersonInput = {
	name: string;
	relationship_type?: z.infer<typeof RelationshipTypeSchema> | null;
	email?: string | null;
	phone?: string | null;
	company?: string | null;
	notes?: string | null;
};

export async function listPeople(
	sb: SupabaseClient,
	filters: { relationshipType?: string } = {},
): Promise<PersonRow[]> {
	let q = sb.from("people").select(PEOPLE_SELECT).order("name", { ascending: true });
	if (filters.relationshipType) q = q.eq("relationship_type", filters.relationshipType);
	const data = unwrap(await q);
	return (data ?? []) as PersonRow[];
}

export async function getPerson(sb: SupabaseClient, id: string): Promise<PersonRow | null> {
	const data = unwrap(await sb.from("people").select(PEOPLE_SELECT).eq("id", id).maybeSingle());
	return (data as PersonRow | null) ?? null;
}

export async function createPerson(
	sb: SupabaseClient,
	input: CreatePersonInput,
): Promise<PersonRow> {
	const data = unwrap(await sb.from("people").insert(input).select(PEOPLE_SELECT).single());
	return data as PersonRow;
}

export async function updatePerson(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreatePersonInput>,
): Promise<void> {
	unwrap(await sb.from("people").update(patch).eq("id", id));
}

/** Cascades to facts/interactions via FK (on delete cascade). */
export async function deletePerson(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("people").delete().eq("id", id));
}

// ─── Person facts ──────────────────────────────────────────────────────

const PERSON_FACT_SELECT =
	"id, person_id, fact_type, fact_value, source_ref, date_relevant, recurring, created_at";

export type PersonFactRow = {
	id: string;
	person_id: string;
	fact_type: z.infer<typeof PersonFactTypeSchema>;
	fact_value: string;
	source_ref: string | null;
	// Bare `date` column — YYYY-MM-DD, stored unconverted (no tz math).
	date_relevant: string | null;
	recurring: boolean;
	created_at: string;
};

export type CreatePersonFactInput = {
	fact_type: z.infer<typeof PersonFactTypeSchema>;
	fact_value: string;
	source_ref?: string | null;
	date_relevant?: string | null;
	recurring?: boolean;
};

export async function listFacts(sb: SupabaseClient, personId: string): Promise<PersonFactRow[]> {
	const data = unwrap(
		await sb
			.from("person_facts")
			.select(PERSON_FACT_SELECT)
			.eq("person_id", personId)
			.order("date_relevant", { ascending: true, nullsFirst: true })
			.order("created_at", { ascending: true }),
	);
	return (data ?? []) as PersonFactRow[];
}

export async function createFact(
	sb: SupabaseClient,
	personId: string,
	input: CreatePersonFactInput,
): Promise<PersonFactRow> {
	const data = unwrap(
		await sb
			.from("person_facts")
			.insert({ ...input, person_id: personId })
			.select(PERSON_FACT_SELECT)
			.single(),
	);
	return data as PersonFactRow;
}

export async function updateFact(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreatePersonFactInput>,
): Promise<void> {
	unwrap(await sb.from("person_facts").update(patch).eq("id", id));
}

export async function deleteFact(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("person_facts").delete().eq("id", id));
}

// ─── Person interactions ───────────────────────────────────────────────

const PERSON_INTERACTION_SELECT = "id, person_id, interaction_type, notes, occurred_at";

export type PersonInteractionRow = {
	id: string;
	person_id: string;
	interaction_type: z.infer<typeof PersonInteractionTypeSchema>;
	notes: string | null;
	occurred_at: string;
};

export type CreatePersonInteractionInput = {
	interaction_type: z.infer<typeof PersonInteractionTypeSchema>;
	notes?: string | null;
	// UTC instant. Callers convert local wall-clock input via lib/dates before
	// reaching the service (iron rule #1) — omit to let the DB default to now().
	occurred_at?: string | null;
};

export async function listInteractions(
	sb: SupabaseClient,
	personId: string,
): Promise<PersonInteractionRow[]> {
	const data = unwrap(
		await sb
			.from("person_interactions")
			.select(PERSON_INTERACTION_SELECT)
			.eq("person_id", personId)
			.order("occurred_at", { ascending: false }),
	);
	return (data ?? []) as PersonInteractionRow[];
}

export async function createInteraction(
	sb: SupabaseClient,
	personId: string,
	input: CreatePersonInteractionInput,
): Promise<PersonInteractionRow> {
	const data = unwrap(
		await sb
			.from("person_interactions")
			.insert({ ...input, person_id: personId })
			.select(PERSON_INTERACTION_SELECT)
			.single(),
	);
	return data as PersonInteractionRow;
}

export async function deleteInteraction(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("person_interactions").delete().eq("id", id));
}
