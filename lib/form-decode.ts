import type { z } from "zod";

// FormData → typed-input decoder. Semantic distinction between ABSENT and
// PRESENT-BUT-BLANK: a key entirely missing from the form (`formData.get(key)
// === null`) is never in the form's UI, so it is OMITTED — the caller's
// `.update(patch)` must not touch that column just because a narrower form
// didn't render it. A field that IS present but submitted blank ("" or
// whitespace) means "clear this", so the schema-derived blank rule applies:
// becomes `null` if the field is nullable (schema.shape[key] accepts null),
// otherwise the key is omitted entirely. This reproduces today's `|| null`
// (clear) and `|| undefined` (omit) behaviors automatically, for both
// create and partial-update schemas, without per-site branching. Boolean
// (checkbox) fields are unaffected by the absent/blank distinction: a
// checkbox spec'd in FormSpec is by definition part of the form, and its
// absence from FormData means unchecked → `false`.

export type FieldKind = "string" | "number" | "boolean";
export type FormSpec = Record<string, FieldKind>; // default per field: "string"

function isNullable(schema: z.ZodObject, key: string): boolean {
	const field = schema.shape[key];
	return field ? field.safeParse(null).success : false;
}

/**
 * Extraction only — reads each key in `schema.shape` out of `formData`,
 * coerces it per `spec` (default "string"), and applies the blank rule.
 * Does NOT validate; pass the result to `schema.parse` (or use
 * `decodeForm`) to get a typed, validated result.
 */
export function decodeFields(
	schema: z.ZodObject,
	formData: FormData,
	spec?: FormSpec,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const key of Object.keys(schema.shape)) {
		const kind = spec?.[key] ?? "string";
		const raw = formData.get(key);

		if (kind === "boolean") {
			result[key] = raw != null && raw !== "";
			continue;
		}

		const absent = raw === null;

		let value: unknown;
		let blank: boolean;

		if (kind === "number") {
			if (typeof raw !== "string" || raw.trim() === "") {
				blank = true;
				value = undefined;
			} else {
				const n = Number(raw);
				blank = !Number.isFinite(n);
				value = n;
			}
		} else {
			if (typeof raw !== "string" || raw.trim() === "") {
				blank = true;
				value = undefined;
			} else {
				blank = false;
				value = raw.trim();
			}
		}

		if (blank) {
			if (absent) {
				// Key never appeared in the form at all — leave the column untouched.
			} else if (isNullable(schema, key)) {
				result[key] = null;
			}
			// else: present-but-blank on a non-nullable field — omit the key entirely.
		} else {
			result[key] = value;
		}
	}

	return result;
}

/**
 * `decodeFields` + `schema.parse`. Throws ZodError on invalid input —
 * unchanged semantics vs. hand-rolled decoding. `overrides` merge last and
 * win (use for computed values — tz-converted datetimes, array fields via
 * `getAll`, id params from the URL — that don't come straight off the form).
 */
export function decodeForm<T extends z.ZodObject>(
	schema: T,
	formData: FormData,
	opts?: { spec?: FormSpec; overrides?: Record<string, unknown> },
): z.infer<T> {
	const fields = decodeFields(schema, formData, opts?.spec);
	return schema.parse({ ...fields, ...opts?.overrides });
}
