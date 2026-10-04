"use client";

import { unstable_rethrow } from "next/navigation";
import { type ActionFailure, GENERIC_FORM_ERROR } from "@/lib/action-result";
import { toastError } from "./toast";

/**
 * A Next control-flow error — redirect(), notFound(). A server action that
 * throws one rejects its promise *and* has the router navigate, so the caller
 * rolls back but must not toast a failure the user never had. unstable_rethrow
 * is the public test: it rethrows exactly these and nothing else.
 */
export function isNavigationError(error: unknown): boolean {
	try {
		unstable_rethrow(error);
		return false;
	} catch {
		return true;
	}
}

export type Failure = { result: ActionFailure } | { thrown: unknown };

/**
 * The one failure → toast path (docs/adr/0077).
 *
 * - A throw: a navigation toasts nothing, anything else the fallback.
 * - A result with a form error: that error, or the fallback when it is the
 *   generic one.
 * - A result without one: nothing when the form already shows its field
 *   errors, else the fallback.
 */
export function toastFailure(
	f: Failure,
	fallback: string,
	opts: { fieldErrorsShown?: boolean } = {},
): void {
	if ("thrown" in f) {
		if (!isNavigationError(f.thrown)) toastError(fallback);
		return;
	}
	const { formError, fieldErrors } = f.result;
	if (formError) {
		toastError(formError === GENERIC_FORM_ERROR ? fallback : formError);
		return;
	}
	if (opts.fieldErrorsShown && fieldErrors && Object.keys(fieldErrors).length > 0) return;
	toastError(fallback);
}
