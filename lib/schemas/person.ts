import { z } from "zod";
import type { Selected } from "@/lib/database";
import { instantFromLocal } from "@/lib/dates";
import { formDecoder } from "@/lib/form-decode";

// People + their facts + interactions. Lightweight CRM, scoped to the
// single user. Three tables share the same person_id FK chain:
//   - people: the contact record
//   - person_facts: low-cardinality long-lived knowledge (birthday, kids' names,
//     anniversaries, follow-ups). Each fact has a type, value, and optional date.
//   - person_interactions: append-only log of touchpoints (call, email, meeting).
//
// Schemas mirror the DB column checks so invalid inputs round-trip cleanly.

export const RelationshipTypeSchema = z.enum([
	"client",
	"family",
	"friend",
	"team",
	"vendor",
	"other",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const PersonSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	relationship_type: RelationshipTypeSchema.nullable().optional(),
	email: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	company: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	created_at: z.string().datetime({ offset: true }),
	updated_at: z.string().datetime({ offset: true }),
});

// All optional fields .nullable() so callers can clear them via PATCH
// without branching per-field. Mirrors the project/note pattern.
export const CreatePersonSchema = z.object({
	name: z.string({ error: "Give the person a name." }).min(1, "Give the person a name."),
	relationship_type: RelationshipTypeSchema.nullable().optional(),
	email: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	company: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const UpdatePersonSchema = CreatePersonSchema.partial();

/** The person forms' one decode each, shared by the optimistic half and the server (docs/adr/0087). */
export const createPersonForm = formDecoder(CreatePersonSchema);
export type CreatePersonFormInput = z.output<typeof CreatePersonSchema>;
export const updatePersonForm = formDecoder(UpdatePersonSchema);
export type UpdatePersonFormInput = z.output<typeof UpdatePersonSchema>;

// ─── Person facts ─────────────────────────────────────────────────────

export const PersonFactTypeSchema = z.enum([
	"anniversary",
	"birthday",
	"kid_name",
	"shared",
	"follow_up",
	"other",
]);
export type PersonFactType = z.infer<typeof PersonFactTypeSchema>;

export const PersonFactSchema = z.object({
	id: z.string().uuid(),
	person_id: z.string().uuid(),
	fact_type: PersonFactTypeSchema,
	fact_value: z.string().min(1),
	source_ref: z.string().nullable().optional(),
	date_relevant: z.string().date().nullable().optional(),
	recurring: z.boolean(),
	created_at: z.string().datetime({ offset: true }),
});

// person_id comes from URL path; body is just the editable fields.
export const CreatePersonFactSchema = z.object({
	fact_type: PersonFactTypeSchema,
	fact_value: z.string().min(1),
	source_ref: z.string().nullable().optional(),
	date_relevant: z.string().date().nullable().optional(),
	recurring: z.boolean().optional(),
});

export const UpdatePersonFactSchema = CreatePersonFactSchema.partial();

/** The add-fact form's one decode (docs/adr/0087). */
export const createPersonFactForm = formDecoder(CreatePersonFactSchema);
export type CreatePersonFactFormInput = z.output<typeof CreatePersonFactSchema>;

// ─── Person interactions ──────────────────────────────────────────────

export const PersonInteractionTypeSchema = z.enum([
	"email",
	"call",
	"in_person",
	"text",
	"meeting",
	"other",
]);
export type PersonInteractionType = z.infer<typeof PersonInteractionTypeSchema>;

export const PersonInteractionSchema = z.object({
	id: z.string().uuid(),
	person_id: z.string().uuid(),
	interaction_type: PersonInteractionTypeSchema,
	notes: z.string().nullable().optional(),
	occurred_at: z.string().datetime({ offset: true }),
});

export const CreatePersonInteractionSchema = z.object({
	interaction_type: PersonInteractionTypeSchema,
	notes: z.string().nullable().optional(),
	// Defaults to now() in the DB if omitted. Allow datetime or date so the
	// form can send a backfill ("met yesterday, log it as yesterday").
	occurred_at: z.string().nullable().optional(),
});

export const UpdatePersonInteractionSchema = CreatePersonInteractionSchema.partial();

/**
 * The add-interaction form's one decode (docs/adr/0087). `occurred_at` is not
 * a form field: each half passes `interactionOccurredAt` as an override.
 */
export const createPersonInteractionForm = formDecoder(CreatePersonInteractionSchema);
export type CreatePersonInteractionFormInput = z.output<typeof CreatePersonInteractionSchema>;

/**
 * The entered day and time in the app timezone, or null (the DB stamps now)
 * when no day was entered. Throws on a day and time that do not parse.
 */
export function interactionOccurredAt(formData: FormData, tz: string): string | null {
	const dateIso = formData.get("occurred_date");
	const time = formData.get("occurred_time");
	if (typeof dateIso !== "string" || !dateIso) return null;
	return instantFromLocal(dateIso, typeof time === "string" && time ? time : "00:00", tz);
}

// ─── Rows the people service reads ─────────────────────────────────────
//
// Each row type is inferred from its literal select (docs: Selected in
// lib/database.ts). No joins for these entities.

export const PEOPLE_SELECT =
	"id, name, relationship_type, email, phone, company, notes, created_at, updated_at" as const;
export type PersonRow = Selected<"people", typeof PEOPLE_SELECT>;

// date_relevant is a bare `date` column: YYYY-MM-DD, stored unconverted.
export const PERSON_FACT_SELECT =
	"id, person_id, fact_type, fact_value, source_ref, date_relevant, recurring, created_at" as const;
export type PersonFactRow = Selected<"person_facts", typeof PERSON_FACT_SELECT>;

export const PERSON_INTERACTION_SELECT =
	"id, person_id, interaction_type, notes, occurred_at" as const;
export type PersonInteractionRow = Selected<
	"person_interactions",
	typeof PERSON_INTERACTION_SELECT
>;
