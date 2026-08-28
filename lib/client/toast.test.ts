import { beforeEach, describe, expect, it, vi } from "vitest";

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const rethrowMock = vi.fn();

vi.mock("sonner", () => ({
	toast: {
		error: (...args: unknown[]) => toastErrorMock(...args),
		success: (...args: unknown[]) => toastSuccessMock(...args),
	},
}));

vi.mock("next/navigation", () => ({
	unstable_rethrow: (error: unknown) => rethrowMock(error),
}));

const { runAction, toastSuccess } = await import("./toast");

describe("toastSuccess", () => {
	beforeEach(() => {
		toastSuccessMock.mockClear();
	});

	it("passes the title and optional description to sonner", () => {
		toastSuccess("Captured", "1 task added.");
		expect(toastSuccessMock).toHaveBeenCalledWith("Captured", {
			description: "1 task added.",
			duration: 4000,
		});
	});
});

describe("runAction", () => {
	beforeEach(() => {
		toastErrorMock.mockClear();
		rethrowMock.mockClear();
	});

	it("returns true and does not toast on success", async () => {
		const ok = await runAction(async () => undefined);
		expect(ok).toBe(true);
		expect(toastErrorMock).not.toHaveBeenCalled();
	});

	it("toasts and returns false on real errors", async () => {
		const ok = await runAction(async () => {
			throw new Error("boom");
		}, "Couldn't delete note.");
		expect(ok).toBe(false);
		expect(rethrowMock).toHaveBeenCalled();
		expect(toastErrorMock).toHaveBeenCalledWith("Couldn't delete note.", expect.anything());
	});

	it("does not toast when Next.js rethrows a redirect", async () => {
		const redirectErr = Object.assign(new Error("NEXT_REDIRECT"), {
			digest: "NEXT_REDIRECT;replace;/notes;307;",
		});
		rethrowMock.mockImplementation((error: unknown) => {
			throw error;
		});

		await expect(
			runAction(async () => {
				throw redirectErr;
			}, "Couldn't delete note."),
		).rejects.toBe(redirectErr);
		expect(toastErrorMock).not.toHaveBeenCalled();
	});
});
