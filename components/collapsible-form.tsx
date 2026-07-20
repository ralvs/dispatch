"use client";

// Shared choreography + chrome for the "+ New X" collapsible create-forms that
// recur across the app (tasks, people, quotes, routines, notes, journal
// entries, domains, projects…). Every one of them
// wired up the identical dance by hand: a form ref, an `open` flag, a
// transition wrapping the server action, and byte-identical Tailwind chrome
// for the collapsed trigger and the open card's footer. This module is that
// dance, extracted once.

import { type ReactNode, useRef, useState, useTransition } from "react";

// The transition-wrapped choreography, pulled out of the hook so it's
// testable without a DOM: submit the action, then reset and collapse — in
// that order, and only after the action settles. No error handling beyond
// what existed before (a rejected action leaves the form open and un-reset,
// same as every form did today).
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
 * Today's exact choreography: submit -> await the action -> reset the form ->
 * close. Do not add error handling here — none of the 15 forms that used this
 * by hand had any, and a rejected action should surface the same way it does
 * today (form stays open, un-reset, whatever the action itself does with the
 * error).
 */
export function useCollapsibleForm(
	action: (formData: FormData) => Promise<unknown>,
): CollapsibleFormState {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(() =>
			runCollapsibleSubmit(action, formData, {
				reset: () => formRef.current?.reset(),
				close: () => setOpen(false),
			}),
		);
	}

	return { open, setOpen, formRef, pending, submit };
}

const TRIGGER_CLASS =
	"w-full rounded-md border border-line px-4 py-2.5 text-left font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink";
const CARD_CLASS = "space-y-3 rounded-xl border border-line-strong bg-surface p-4";
const FOOTER_CLASS = "flex gap-2 pt-1";
const SUBMIT_CLASS =
	"rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50";
const CANCEL_CLASS = "px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3";

/**
 * The collapsed "+ New …" trigger. Byte-identical across every form that used
 * it — only the label changes.
 */
export function CollapsedTrigger({ label, onOpen }: { label: string; onOpen: () => void }) {
	return (
		<button type="button" onClick={onOpen} className={TRIGGER_CLASS}>
			{label}
		</button>
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
		<form ref={formRef} action={submit} className={CARD_CLASS}>
			{children}
			<div className={FOOTER_CLASS}>
				<button type="submit" disabled={pending} className={SUBMIT_CLASS}>
					{pending ? pendingLabel : submitLabel}
				</button>
				<button type="button" onClick={onCancel} className={CANCEL_CLASS}>
					Cancel
				</button>
			</div>
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
