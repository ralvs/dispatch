"use client";

// Shared choreography + chrome for the header `+` dialog that ADR-0044 made
// the one way an object list creates an object. Pass 2 rebuilt it four times
// by hand — people, projects, quotes and routines each carried the same
// `open` / `useTransition` / `formRef` scaffold and the same two-button
// footer — which is the same failure `collapsible-form.tsx` was extracted to
// end for the inline-form era this replaced. The copies had already drifted
// apart in their error strings before the pass shipped.
//
// The trigger is the bare pill `+` shared with `/tasks` (HeaderCreateButton),
// not a labelled `+ New X`: every object list now carries the same control.

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogBody,
	DialogFooter,
	FIRST_INVALID,
	FormButton,
	FormStateProvider,
	HeaderCreateButton,
	SubmitButton,
	useResultAction,
} from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

/**
 * The standing header `+` on its own, with no dialog behind it.
 *
 * Exported so a route's `loading.tsx` holds the slot with the *same* element
 * the loaded page will render (DESIGN.md, "The Invisible Slot Rule").
 */
export function CreateTrigger({
	label,
	onClick,
	disabled = false,
}: {
	/** Accessible name — `New project`. Not drawn; the glyph is the control. */
	label: string;
	onClick?: () => void;
	/** Held but not yet ready, which is what a loading route wants. */
	disabled?: boolean;
}) {
	return <HeaderCreateButton label={label} onClick={onClick} disabled={disabled} />;
}

/**
 * Create an object: a header `+` that opens a dialog, runs a server action,
 * and closes on success (ADR-0044, DESIGN.md "Creating an object").
 *
 * A call site supplies its `<Field name>`s and its four strings. Everything
 * else — the open flag, the action state, the footer's Cancel/submit pair —
 * lives here, so a change to the create contract is one edit rather than five
 * with nothing to catch a miss.
 *
 * A rejected field keeps the dialog open with its message under the field and
 * the typing still in place (#23); focus moves to the first rejected field.
 * An unexpected failure is a toast. Success is silent, because the new row
 * appearing in the list is the confirmation.
 */
export function CreateDialogButton({
	label,
	title,
	submitLabel,
	errorMessage,
	action,
	size,
	children,
}: {
	/** Trigger accessible name — `New project`. The glyph is what is drawn. */
	label: string;
	/** Dialog heading — `New project`. */
	title: string;
	/** Primary button — `Add project`. */
	submitLabel: string;
	/** The failure toast. There is no success toast. */
	errorMessage: string;
	action: (formData: FormData) => Promise<ActionResult<unknown>>;
	/** Widen the panel for a form that runs to a second column of fields. */
	size?: "sm" | "md" | "lg";
	/** The form's fields, and only those. */
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<CreateTrigger label={label} onClick={() => setOpen(true)} />
			<Dialog open={open} onClose={() => setOpen(false)} title={title} size={size}>
				{/* Mounted only while open (Dialog), so every open starts clean. */}
				<CreateDialogForm
					action={action}
					errorMessage={errorMessage}
					submitLabel={submitLabel}
					onDone={() => setOpen(false)}
				>
					{children}
				</CreateDialogForm>
			</Dialog>
		</>
	);
}

function CreateDialogForm({
	action,
	errorMessage,
	submitLabel,
	onDone,
	children,
}: {
	action: (formData: FormData) => Promise<ActionResult<unknown>>;
	errorMessage: string;
	submitLabel: string;
	onDone: () => void;
	children: ReactNode;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction] = useResultAction(action, { onSuccess: onDone, errorMessage });

	useEffect(() => {
		if (state.fieldErrors) formRef.current?.querySelector<HTMLElement>(FIRST_INVALID)?.focus();
	}, [state]);

	return (
		<form ref={formRef} action={formAction} noValidate>
			<FormStateProvider state={state}>
				<DialogBody className="space-y-7">{children}</DialogBody>
			</FormStateProvider>
			<DialogFooter>
				<span className="min-w-2 flex-1" />
				<FormButton variant="tertiary" size="sm" onClick={onDone}>
					Cancel
				</FormButton>
				<SubmitButton variant="primary" size="sm">
					{submitLabel}
				</SubmitButton>
			</DialogFooter>
		</form>
	);
}
