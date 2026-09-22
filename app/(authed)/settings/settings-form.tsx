"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { FIRST_INVALID, FormStateProvider, SubmitButton, useResultAction } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

/**
 * The one shell behind every /settings form: fields in a row, a Save, and a
 * note under them. The timezone and reminder forms used to be two copies of it
 * that differed only in their fields and strings.
 *
 * Success is silent — the saved value stays on screen. A rejected field shows
 * its message under the field (#23); an unexpected failure is a toast.
 */
export function SettingsForm({
	action,
	errorMessage,
	note,
	children,
}: {
	action: (formData: FormData) => Promise<ActionResult<unknown>>;
	errorMessage: string;
	/** The line under the row: what the setting governs. */
	note: ReactNode;
	/** The `<Field name>`s. */
	children: ReactNode;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction] = useResultAction(action, { errorMessage });

	useEffect(() => {
		if (state.fieldErrors) formRef.current?.querySelector<HTMLElement>(FIRST_INVALID)?.focus();
	}, [state]);

	return (
		<form
			ref={formRef}
			action={formAction}
			noValidate
			className="mt-2 flex flex-wrap items-end gap-3"
		>
			<FormStateProvider state={state}>{children}</FormStateProvider>
			<SubmitButton variant="tertiary" size="sm" pendingLabel="Saving…">
				Save
			</SubmitButton>
			<p className="w-full font-mono text-meta text-ink-4">{note}</p>
		</form>
	);
}
