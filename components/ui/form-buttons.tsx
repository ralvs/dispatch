"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

type ButtonProps = Omit<ComponentProps<typeof Button>, "type" | "isPending">;

/**
 * The submit button of the form it sits in. Reads the form's own pending state
 * with `useFormStatus`, so no shell passes `pending` down to it.
 */
export function SubmitButton({
	children,
	pendingLabel,
	disabled,
	...props
}: ButtonProps & { pendingLabel?: string }) {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" isPending={pending} disabled={pending || disabled} {...props}>
			{pending && pendingLabel ? pendingLabel : children}
		</Button>
	);
}

/** A non-submit button that is disabled while its form is submitting — Cancel, Delete. */
export function FormButton({ disabled, ...props }: ButtonProps) {
	const { pending } = useFormStatus();
	return <Button type="button" disabled={pending || disabled} {...props} />;
}
