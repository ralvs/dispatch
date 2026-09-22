"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { FieldErrors } from "@/lib/action-result";

/**
 * What the last submit of the enclosing form came back with (#23): each
 * field's errors, and the values the user had typed. `<Field name>` shows the
 * error; `Input`, `Select` and `Textarea` read their value back by `name`, so a
 * validation error does not wipe the form when React resets it.
 *
 * Empty outside a form shell, so a field with no provider behaves as before.
 */
export type FormState = {
	fieldErrors?: FieldErrors;
	values?: Record<string, string>;
};

const FormStateContext = createContext<FormState>({});

export function FormStateProvider({ state, children }: { state: FormState; children: ReactNode }) {
	return <FormStateContext.Provider value={state}>{children}</FormStateContext.Provider>;
}

/** The first error for a field, if the last submit rejected it. */
export function useFieldError(name: string | undefined): string | undefined {
	const { fieldErrors } = useContext(FormStateContext);
	return name ? fieldErrors?.[name]?.[0] : undefined;
}

/** What the user typed into a field before the last submit came back rejected. */
export function useFieldValue(name: string | undefined): string | undefined {
	const { values } = useContext(FormStateContext);
	return name ? values?.[name] : undefined;
}
