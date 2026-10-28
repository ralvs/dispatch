import { beforeEach, describe, expect, it, vi } from "vitest";

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastInfoMock = vi.fn();
const rethrowMock = vi.fn();

vi.mock("notch-toast", () => ({
	toast: {
		error: (...args: unknown[]) => toastErrorMock(...args),
		success: (...args: unknown[]) => toastSuccessMock(...args),
		info: (...args: unknown[]) => toastInfoMock(...args),
	},
}));

vi.mock("next/navigation", () => ({
	unstable_rethrow: (error: unknown) => rethrowMock(error),
}));

const { runAction, toastNotice, toastSuccess } = await import("./toast");

describe("toastSuccess", () => {
	beforeEach(() => {
		toastSuccessMock.mockClear();
	});

	it("folds the optional description into the title", () => {
		toastSuccess("Captured", "1 task added.");
		expect(toastSuccessMock).toHaveBeenCalledWith("Captured · 1 task added.", {
			duration: 4000,
		});
	});

	it("shows the title alone without a description", () => {
		toastSuccess("Captured");
		expect(toastSuccessMock).toHaveBeenCalledWith("Captured", { duration: 4000 });
	});
});

describe("toastNotice", () => {
	beforeEach(() => {
		toastInfoMock.mockClear();
	});

	it("fires an info toast", () => {
		toastNotice("Reopened");
		expect(toastInfoMock).toHaveBeenCalledWith("Reopened", { duration: 4000 });
	});
});

describe("runAction", () => {
	beforeEach(() => {
		toastErrorMock.mockClear();
		toastSuccessMock.mockClear();
		rethrowMock.mockClear();
	});

	it("returns true and does not toast on success without copy", async () => {
		const ok = await runAction(async () => undefined);
		expect(ok).toBe(true);
		expect(toastErrorMock).not.toHaveBeenCalled();
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});

	it("toasts the success copy when given", async () => {
		const ok = await runAction(async () => undefined, "Couldn't link that.", "Linked");
		expect(ok).toBe(true);
		expect(toastSuccessMock).toHaveBeenCalledWith("Linked", { duration: 4000 });
	});

	it("does not toast success on failure", async () => {
		const ok = await runAction(
			async () => {
				throw new Error("boom");
			},
			"Couldn't link that.",
			"Linked",
		);
		expect(ok).toBe(false);
		expect(toastSuccessMock).not.toHaveBeenCalled();
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
