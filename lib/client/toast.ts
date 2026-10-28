"use client";

import { unstable_rethrow } from "next/navigation";
import { toast } from "notch-toast";

/**
 * notch-toast shows one toast at a time, title only: a newer toast replaces
 * the one on screen, and a description rides on the title after a dot.
 */
function line(message: string, description?: string): string {
	return description ? `${message} · ${description}` : message;
}

export function toastError(message = "Something went wrong. Try again."): void {
	toast.error(message, {
		duration: 5000,
	});
}

/** Receipts and confirmed writes: a coloured tick. */
export function toastSuccess(message: string, description?: string): void {
	toast.success(line(message, description), {
		duration: 4000,
	});
}

/** Neutral slip — reopen, and anything that is not a success or a failure. */
export function toastNotice(message: string, description?: string): void {
	toast.info(line(message, description), {
		duration: 4000,
	});
}

/**
 * Run a server action / async mutation; toast on failure, and on success when
 * given `success` copy.
 * Returns true on success so callers can gate follow-up UI (close form, etc.).
 *
 * Rethrows Next.js control-flow errors (`redirect`, `notFound`, …) so actions
 * that navigate after a successful mutation aren't reported as failures.
 */
export async function runAction(
	action: () => Promise<unknown>,
	message = "Something went wrong. Try again.",
	success?: string,
): Promise<boolean> {
	try {
		await action();
	} catch (error) {
		unstable_rethrow(error);
		toastError(message);
		return false;
	}
	if (success) toastSuccess(success);
	return true;
}
