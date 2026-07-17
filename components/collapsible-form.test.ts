import { describe, expect, it, vi } from "vitest";
import { runCollapsibleSubmit } from "@/components/collapsible-form";

// No DOM test harness is set up in this repo (vitest runs in the "node"
// environment, no jsdom/testing-library), so the choreography itself — not
// the hook or the JSX around it — is pulled out into a plain async function
// and tested directly here.

describe("runCollapsibleSubmit", () => {
	it("awaits the action, then resets and closes in that order", async () => {
		const order: string[] = [];
		const action = vi.fn(async () => {
			order.push("action");
		});
		const reset = vi.fn(() => order.push("reset"));
		const close = vi.fn(() => order.push("close"));
		const formData = new FormData();

		await runCollapsibleSubmit(action, formData, { reset, close });

		expect(action).toHaveBeenCalledWith(formData);
		expect(order).toEqual(["action", "reset", "close"]);
	});

	it("does not reset or close if the action rejects", async () => {
		const reset = vi.fn();
		const close = vi.fn();
		const action = vi.fn(async () => {
			throw new Error("boom");
		});

		await expect(runCollapsibleSubmit(action, new FormData(), { reset, close })).rejects.toThrow(
			"boom",
		);
		expect(reset).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();
	});

	it("waits for the action to settle before resetting (not fire-and-forget)", async () => {
		let resolveAction: (() => void) | undefined;
		const action = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveAction = resolve;
				}),
		);
		const reset = vi.fn();
		const close = vi.fn();

		const promise = runCollapsibleSubmit(action, new FormData(), { reset, close });
		// Action is in flight — nothing has run yet.
		expect(reset).not.toHaveBeenCalled();
		expect(close).not.toHaveBeenCalled();

		resolveAction?.();
		await promise;

		expect(reset).toHaveBeenCalledOnce();
		expect(close).toHaveBeenCalledOnce();
	});
});
