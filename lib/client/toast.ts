"use client";

import { toast } from "sonner";

/** Failure-only surface. Do not use for success. */
export function toastError(message = "Something went wrong. Try again."): void {
	toast.error(message, {
		duration: 5000,
	});
}

/**
 * Run a server action / async mutation; toast on failure.
 * Returns true on success so callers can gate follow-up UI (close form, etc.).
 */
export async function runAction(
	action: () => Promise<unknown>,
	message = "Something went wrong. Try again.",
): Promise<boolean> {
	try {
		await action();
		return true;
	} catch {
		toastError(message);
		return false;
	}
}
