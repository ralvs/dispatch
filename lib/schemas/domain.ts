import { z } from "zod";
import { ColorSlugSchema } from "@/lib/schemas/color";

export const FailurePatternSchema = z
	.object({
		rule: z.string(),
		value: z.unknown().optional(),
	})
	.passthrough();

export const DomainSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	fruit_definition: z.string().nullable().optional(),
	failure_patterns: z.array(FailurePatternSchema).default([]),
	expected_cadence: z.string().nullable().optional(),
	active: z.boolean(),
	// Added by migration 0027. Manual "I shipped something" timestamp for
	// domains whose work lives off-dashboard (Substack, social, etc.). The
	// cadence helper's days_since_publish rule reads MAX of this and the
	// latest content_items.published_at.
	last_shipped_at: z.string().datetime({ offset: true }).nullable().optional(),
	// .nullable() is load-bearing: lib/form-decode.ts's isNullable probe
	// (field.safeParse(null).success) is what turns a blank "None" swatch
	// submission into an explicit null that CLEARS the column.
	color: ColorSlugSchema.nullable().optional(),
	created_at: z.string().datetime({ offset: true }),
	updated_at: z.string().datetime({ offset: true }),
});

// Create-time shape used by the "new domain" form. active/last_shipped_at are
// not settable on create — new domains are always active, and last_shipped_at
// starts unset.
export const CreateDomainSchema = z.object({
	name: z.string({ error: "Give the domain a name." }).min(1, "Give the domain a name."),
	description: z.string().nullable().optional(),
	fruit_definition: z.string().nullable().optional(),
	expected_cadence: z.string().nullable().optional(),
	// .nullable() is load-bearing — see DomainRowSchema.color.
	color: ColorSlugSchema.nullable().optional(),
});

// Patch shape used by the UI's edit form. failure_patterns is included so
// the cadence rule editor on the domain detail page can replace the whole
// array atomically (advanced rule types still get edited via SQL; the
// editor only manages the primary cadence rule, but it sends the merged
// final array).
export const UpdateDomainSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	fruit_definition: z.string().nullable().optional(),
	expected_cadence: z.string().nullable().optional(),
	active: z.boolean().optional(),
	failure_patterns: z.array(FailurePatternSchema).optional(),
	// Stamped via the "Mark shipped" button on the domain detail page.
	// Accept ISO datetime or null (to clear).
	last_shipped_at: z.string().datetime({ offset: true }).nullable().optional(),
	// .nullable() is load-bearing — see DomainRowSchema.color.
	color: ColorSlugSchema.nullable().optional(),
});

// ─── Row shape actually returned by the domains service ────────────────
//
// Mirrors exactly the columns DOMAIN_SELECT reads (lib/services/domains.ts).
// DOMAIN_SELECT is derived from this schema's keys. No joins for this
// entity.
export const DomainRowSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	fruit_definition: z.string().nullable(),
	failure_patterns: z.unknown(),
	expected_cadence: z.string().nullable(),
	active: z.boolean(),
	last_shipped_at: z.string().nullable(),
	color: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});
export type DomainRow = z.infer<typeof DomainRowSchema>;

export const DOMAIN_SELECT = Object.keys(DomainRowSchema.shape).join(", ");

/**
 * What the nightly sweep measures for one active domain
 * (lib/services/observations.ts). Here, not there, so client code can name it.
 */
export type DomainTouch = {
	domainId: string;
	name: string;
	/** UTC ISO of the most recent touch, or null when nothing has ever touched it. */
	lastTouchUtc: string | null;
	/** Whole days since the last touch; null when there has never been one. */
	daysSinceTouch: number | null;
	/** The domain's own "flag after N days" rule; null means never flag. */
	thresholdDays: number | null;
	openTasks: number;
	/** Has a threshold, and is past it (or has never been touched at all). */
	quiet: boolean;
};

/**
 * A domain as /domains shows it, and as the entity store holds it (#30): the
 * row, its cadence rule read out of `failure_patterns`, and its last touch.
 * Both are server-derived — the parser and the touch fold are server-only —
 * so every write answers with the whole item.
 */
export type DomainItem = DomainRow & {
	cadenceDays: number | null;
	/** Null for an archived domain — the sweep only measures active ones. */
	touch: DomainTouch | null;
};
