"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";
import { type ActionResult, formValues } from "@/lib/action-result";
import { toastFailure } from "@/lib/client/failure";
import type { FormState } from "./form-state";

/**
 * `useActionState` over an action that returns an `ActionResult` (#22, #23).
 *
 * - Success runs `onSuccess` and clears the state. React resets the form's
 *   uncontrolled fields on its own.
 * - Field errors go into the state, for `<Field name>` to show, with the
 *   typed values echoed back so the reset does not wipe them.
 * - A form error, a request that never came back, or a failure with no field
 *   errors to show is the only toast (toastFailure).
 *
 * Put this in a component that mounts with the form, so a closed-and-reopened
 * form starts clean.
 */
export function useResultAction(
	action: (formData: FormData) => Promise<ActionResult<unknown>>,
	{ onSuccess, errorMessage }: { onSuccess?: () => void; errorMessage: string },
) {
	return useActionState(async (_previous: FormState, formData: FormData): Promise<FormState> => {
		let result: ActionResult<unknown>;
		try {
			result = await action(formData);
		} catch (error) {
			unstable_rethrow(error);
			toastFailure({ thrown: error }, errorMessage);
			return { values: formValues(formData) };
		}
		if (result.ok) {
			onSuccess?.();
			return {};
		}
		toastFailure({ result }, errorMessage, { fieldErrorsShown: true });
		return { fieldErrors: result.fieldErrors, values: result.values ?? formValues(formData) };
	}, {});
}

/** Selector for the first field a submit rejected, for moving focus to it. */
export const FIRST_INVALID = '[aria-invalid="true"]';
