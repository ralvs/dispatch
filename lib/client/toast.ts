"use client";

import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

export function toastError(message = "Something went wrong. Try again."): void {
	toast.error(message, {
		duration: 5000,
	});
}

/** Closed-palette capture receipts. In-dialog success is a check on the row. */
export function toastSuccess(message: string, description?: string): void {
	toast.success(message, {
		description,
		duration: 4000,
	});
}

/**
 * Run a server action / async mutation; toast on failure.
 * Returns true on success so callers can gate follow-up UI (close form, etc.).
 *
 * Rethrows Next.js control-flow errors (`redirect`, `notFound`, …) so actions
 * that navigate after a successful mutation aren't reported as failures.
 */
export async function runAction(
	action: () => Promise<unknown>,
	message = "Something went wrong. Try again.",
): Promise<boolean> {
	try {
		await action();
		return true;
	} catch (error) {
		unstable_rethrow(error);
		toastError(message);
		return false;
	}
}
