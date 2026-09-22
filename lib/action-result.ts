import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

/**
 * What a form-fed server action returns (#22).
 *
 * Throwing does not work for validation: React redacts server action errors in
 * production, so a rejected field reached the client as one generic failure.
 * A result travels intact. On failure it carries:
 *
 * - `fieldErrors` — messages keyed by form field name, shown under the field.
 * - `formError` — one message for the form as a whole (unexpected failures).
 * - `values` — the submitted strings. React 19 resets an uncontrolled form
 *   after its action, so without the echo an error would also wipe what the
 *   user typed. The form reads them back as default values.
 *
 * On success, `data` is what the action wrote — the entity store (#25) will
 * confirm its optimistic rows from it.
 */
export type FieldErrors = Record<string, string[]>;

export type ActionFailure = {
	ok: false;
	fieldErrors?: FieldErrors;
	formError?: string;
	values?: Record<string, string>;
};

export type ActionResult<T = void> = { ok: true; data: T } | ActionFailure;

export const GENERIC_FORM_ERROR = "Something went wrong. Try again.";

/** Field issues under their field; an issue with no path becomes the form error. */
export function fromZodError(error: z.ZodError): ActionFailure {
	const flat = z.flattenError(error);
	const fieldErrors: FieldErrors = {};
	for (const [field, messages] of Object.entries(flat.fieldErrors)) {
		if (Array.isArray(messages) && messages.length > 0) fieldErrors[field] = messages as string[];
	}
	const hasFields = Object.keys(fieldErrors).length > 0;
	return {
		ok: false,
		...(hasFields ? { fieldErrors } : {}),
		...(flat.formErrors.length > 0 ? { formError: flat.formErrors[0] } : {}),
		...(!hasFields && flat.formErrors.length === 0 ? { formError: GENERIC_FORM_ERROR } : {}),
	};
}

/** The submitted string fields, minus files and the keys React adds for its own use. */
export function formValues(formData: FormData): Record<string, string> {
	const values: Record<string, string> = {};
	for (const [key, value] of formData.entries()) {
		if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
	}
	return values;
}

/**
 * Run the body of a form-fed action and turn its outcome into a result.
 *
 * Call `requireOwnerPage()` BEFORE this, never inside: an auth failure is a
 * redirect, not a field error (iron rule #2). `redirect()` and `notFound()`
 * thrown inside still work — they are rethrown, never caught into a result.
 */
export async function runFormAction<T>(
	formData: FormData,
	body: () => Promise<T>,
): Promise<ActionResult<T>> {
	try {
		return { ok: true, data: await body() };
	} catch (error) {
		unstable_rethrow(error);
		if (error instanceof z.ZodError)
			return { ...fromZodError(error), values: formValues(formData) };
		// Unexpected: keep the detail on the server, send the client one sentence.
		console.error(error);
		return { ok: false, formError: GENERIC_FORM_ERROR, values: formValues(formData) };
	}
}
