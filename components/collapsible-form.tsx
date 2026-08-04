"use client";

// Shared choreography + chrome for the "+ New X" collapsible create-forms that
// recur across the app (tasks, people, quotes, routines, notes, journal
// entries, domains, projects…). Every one of them
// wired up the identical dance by hand: a form ref, an `open` flag, a
// transition wrapping the server action, and byte-identical Tailwind chrome
// for the collapsed trigger and the open card's footer. This module is that
// dance, extracted once.

import { unstable_rethrow } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toastError } from "@/lib/client/toast";

// The transition-wrapped choreography, pulled out of the hook so it's
// testable without a DOM: submit the action, then reset and collapse — in
// that order, and only after the action settles. On reject: leave form open
// and un-reset (caller/UI toast via useCollapsibleForm).
export async function runCollapsibleSubmit(
	action: (formData: FormData) => Promise<unknown>,
	formData: FormData,
	callbacks: { reset: () => void; close: () => void },
): Promise<void> {
	await action(formData);
	callbacks.reset();
	callbacks.close();
}

export type CollapsibleFormState = {
	open: boolean;
	setOpen: (open: boolean) => void;
	formRef: React.RefObject<HTMLFormElement | null>;
	pending: boolean;
	submit: (formData: FormData) => void;
};

/**
 * Submit → await action → reset → close. On failure: form stays open,
 * toast surfaces the error (failure-only; no success toast).
 */
export function useCollapsibleForm(
	action: (formData: FormData) => Promise<unknown>,
	errorMessage = "Couldn't save. Try again.",
): CollapsibleFormState {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			try {
				await runCollapsibleSubmit(action, formData, {
					reset: () => formRef.current?.reset(),
					close: () => setOpen(false),
				});
			} catch (error) {
				unstable_rethrow(error);
				toastError(errorMessage);
			}
		});
	}

	return { open, setOpen, formRef, pending, submit };
}

const FOOTER_CLASS = "flex gap-2 pt-2";

/**
 * The collapsed "+ New …" trigger. Byte-identical across every form that used
 * it — only the label changes.
 */
export function CollapsedTrigger({ label, onOpen }: { label: string; onOpen: () => void }) {
	return (
		<Button type="button" variant="tertiary" fullWidth className="justify-start px-4" onClick={onOpen}>
			{label}
		</Button>
	);
}

/**
 * The open card: the form element, its footer (submit + cancel), and
 * whatever fields the caller passes as children. Only the submit/pending
 * labels vary between forms.
 */
export function CollapsibleFormCard({
	formRef,
	submit,
	pending,
	pendingLabel,
	submitLabel,
	onCancel,
	children,
}: {
	formRef: React.RefObject<HTMLFormElement | null>;
	submit: (formData: FormData) => void;
	pending: boolean;
	pendingLabel: string;
	submitLabel: string;
	onCancel: () => void;
	children: ReactNode;
}) {
	return (
		<form ref={formRef} action={submit}>
			<Card className="space-y-4" padding="default">
				{children}
				<div className={FOOTER_CLASS}>
					<Button type="submit" variant="primary" isPending={pending} disabled={pending}>
						{pending ? pendingLabel : submitLabel}
					</Button>
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				</div>
			</Card>
		</form>
	);
}

/**
 * Composes the two chrome pieces above over a `useCollapsibleForm` instance.
 * Renders the collapsed trigger when closed, the card (with the caller's
 * fields as children) when open.
 */
export function CollapsibleForm({
	form,
	triggerLabel,
	submitLabel,
	pendingLabel,
	children,
}: {
	form: CollapsibleFormState;
	triggerLabel: string;
	submitLabel: string;
	pendingLabel: string;
	children: ReactNode;
}) {
	if (!form.open) {
		return <CollapsedTrigger label={triggerLabel} onOpen={() => form.setOpen(true)} />;
	}
	return (
		<CollapsibleFormCard
			formRef={form.formRef}
			submit={form.submit}
			pending={form.pending}
			pendingLabel={pendingLabel}
			submitLabel={submitLabel}
			onCancel={() => form.setOpen(false)}
		>
			{children}
		</CollapsibleFormCard>
	);
}
