import { z } from "zod";

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
	name: z.string().min(1),
	relationship_type: RelationshipTypeSchema.nullable().optional(),
	email: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	company: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const UpdatePersonSchema = CreatePersonSchema.partial();

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

// ─── Row shape actually returned by the people service ──────────────────
//
// Mirrors exactly the columns PEOPLE_SELECT reads (lib/services/people.ts).
// PEOPLE_SELECT is derived from this schema's keys. No joins for this
// entity.
export const PersonRowSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	relationship_type: RelationshipTypeSchema.nullable(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	company: z.string().nullable(),
	notes: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});
export type PersonRow = z.infer<typeof PersonRowSchema>;

export const PEOPLE_SELECT = Object.keys(PersonRowSchema.shape).join(", ");

// ─── Row shape actually returned by the person_facts service ───────────
//
// Mirrors exactly the columns PERSON_FACT_SELECT reads
// (lib/services/people.ts). No joins for this entity.
export const PersonFactRowSchema = z.object({
	id: z.string().uuid(),
	person_id: z.string().uuid(),
	fact_type: PersonFactTypeSchema,
	fact_value: z.string(),
	source_ref: z.string().nullable(),
	// Bare `date` column — YYYY-MM-DD, stored unconverted (no tz math).
	date_relevant: z.string().nullable(),
	recurring: z.boolean(),
	created_at: z.string(),
});
export type PersonFactRow = z.infer<typeof PersonFactRowSchema>;

export const PERSON_FACT_SELECT = Object.keys(PersonFactRowSchema.shape).join(", ");

// ─── Row shape actually returned by the person_interactions service ────
//
// Mirrors exactly the columns PERSON_INTERACTION_SELECT reads
// (lib/services/people.ts). No joins for this entity.
export const PersonInteractionRowSchema = z.object({
	id: z.string().uuid(),
	person_id: z.string().uuid(),
	interaction_type: PersonInteractionTypeSchema,
	notes: z.string().nullable(),
	occurred_at: z.string(),
});
export type PersonInteractionRow = z.infer<typeof PersonInteractionRowSchema>;

export const PERSON_INTERACTION_SELECT = Object.keys(PersonInteractionRowSchema.shape).join(", ");
