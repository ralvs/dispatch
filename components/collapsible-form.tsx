"use client";

// Shared choreography + chrome for the "+ New X" collapsible create-form. Only
// the journal still uses it — the object lists moved to the header `+` dialog
// (components/create-dialog.tsx, ADR-0044) — but the contract is the same:
// submit, then reset and collapse on success; on a rejected field, stay open
// with the message under the field and the typing still in place (#23).

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	Card,
	FIRST_INVALID,
	FormButton,
	FormStateProvider,
	SubmitButton,
	useResultAction,
} from "@/components/ui";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** Cancel left of primary; primary is the rightmost control. */
const FOOTER_CLASS = "flex justify-end gap-2 pt-2";

/**
 * The collapsed "+ New …" trigger. Byte-identical across every form that used
 * it — only the label changes.
 */
export function CollapsedTrigger({ label, onOpen }: { label: string; onOpen: () => void }) {
	return (
		<Button
			type="button"
			variant="tertiary"
			fullWidth
			className="justify-start px-4"
			onClick={onOpen}
		>
			{label}
		</Button>
	);
}

/**
 * The collapsed trigger when closed; the card, with the caller's `<Field
 * name>`s, when open. The card mounts on open, so every open starts clean.
 */
export function CollapsibleForm({
	action,
	errorMessage = "Couldn't save. Try again.",
	triggerLabel,
	submitLabel,
	pendingLabel,
	children,
}: {
	action: (formData: FormData) => Promise<ActionResult<unknown>>;
	/** The failure toast, for an unexpected failure. There is no success toast. */
	errorMessage?: string;
	triggerLabel: string;
	submitLabel: string;
	pendingLabel: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	if (!open) return <CollapsedTrigger label={triggerLabel} onOpen={() => setOpen(true)} />;
	return (
		<CollapsibleFormCard
			action={action}
			errorMessage={errorMessage}
			submitLabel={submitLabel}
			pendingLabel={pendingLabel}
			onDone={() => setOpen(false)}
		>
			{children}
		</CollapsibleFormCard>
	);
}

function CollapsibleFormCard({
	action,
	errorMessage,
	submitLabel,
	pendingLabel,
	onDone,
	children,
}: {
	action: (formData: FormData) => Promise<ActionResult<unknown>>;
	errorMessage: string;
	submitLabel: string;
	pendingLabel: string;
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
			<Card className="space-y-4" padding="default">
				<FormStateProvider state={state}>{children}</FormStateProvider>
				<div className={FOOTER_CLASS}>
					<FormButton variant="ghost" onClick={onDone}>
						Cancel
					</FormButton>
					<SubmitButton variant="primary" pendingLabel={pendingLabel}>
						{submitLabel}
					</SubmitButton>
				</div>
			</Card>
		</form>
	);
}
