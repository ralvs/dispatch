import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { MentionCandidate } from "@/lib/mentions";
import {
	type CreatePersonFactSchema,
	type CreatePersonInteractionSchema,
	type CreatePersonSchema,
	PEOPLE_SELECT,
	PERSON_FACT_SELECT,
	PERSON_INTERACTION_SELECT,
	type PersonFactRow,
	type PersonInteractionRow,
	type PersonRow,
} from "@/lib/schemas/person";
import { unwrap } from "@/lib/services/errors";

// ─── People ─────────────────────────────────────────────────────────────

export type { PersonRow };

export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;

export async function listPeople(
	sb: SupabaseClient,
	filters: { relationshipType?: string } = {},
): Promise<PersonRow[]> {
	let q = sb.from("people").select(PEOPLE_SELECT).order("name", { ascending: true });
	if (filters.relationshipType) q = q.eq("relationship_type", filters.relationshipType);
	const data = unwrap(await q);
	return (data ?? []) as unknown as PersonRow[];
}

export async function getPerson(sb: SupabaseClient, id: string): Promise<PersonRow | null> {
	const data = unwrap(await sb.from("people").select(PEOPLE_SELECT).eq("id", id).maybeSingle());
	return (data as unknown as PersonRow | null) ?? null;
}

export async function createPerson(
	sb: SupabaseClient,
	input: CreatePersonInput,
): Promise<PersonRow> {
	const data = unwrap(await sb.from("people").insert(input).select(PEOPLE_SELECT).single());
	return data as unknown as PersonRow;
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

/** id + name only — what lib/mentions.ts's buildMentionIndex needs, nothing more. */
export async function listMentionCandidates(sb: SupabaseClient): Promise<MentionCandidate[]> {
	const data = unwrap(await sb.from("people").select("id, name"));
	return (data ?? []) as unknown as MentionCandidate[];
}

// ─── Person facts ──────────────────────────────────────────────────────

export type { PersonFactRow };

export type CreatePersonFactInput = z.infer<typeof CreatePersonFactSchema>;

export async function listFacts(sb: SupabaseClient, personId: string): Promise<PersonFactRow[]> {
	const data = unwrap(
		await sb
			.from("person_facts")
			.select(PERSON_FACT_SELECT)
			.eq("person_id", personId)
			.order("date_relevant", { ascending: true, nullsFirst: true })
			.order("created_at", { ascending: true }),
	);
	return (data ?? []) as unknown as PersonFactRow[];
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
	return data as unknown as PersonFactRow;
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

export type { PersonInteractionRow };

// occurred_at: UTC instant. Callers convert local wall-clock input via
// lib/dates before reaching the service (iron rule #1) — omit to let the
// DB default to now().
export type CreatePersonInteractionInput = z.infer<typeof CreatePersonInteractionSchema>;

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
	return (data ?? []) as unknown as PersonInteractionRow[];
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
	return data as unknown as PersonInteractionRow;
}

export async function deleteInteraction(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("person_interactions").delete().eq("id", id));
}
