import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_FORM_ERROR } from "@/lib/action-result";
import { type Failure, toastFailure } from "./failure";
import { toastError } from "./toast";

vi.mock("./toast", () => ({ toastError: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
	digest: "NEXT_REDIRECT;replace;/x;307;",
});
const fieldErrors = { name: ["Required"] };

describe("toastFailure", () => {
	it.each<{ name: string; f: Failure; shown?: boolean; toast: string | null }>([
		{ name: "a throw", f: { thrown: new Error("boom") }, toast: "Fallback" },
		{ name: "a navigation", f: { thrown: redirect }, toast: null },
		{ name: "a form error", f: { result: { ok: false, formError: "Gone" } }, toast: "Gone" },
		{
			name: "the generic form error",
			f: { result: { ok: false, formError: GENERIC_FORM_ERROR } },
			toast: "Fallback",
		},
		{
			name: "field errors the form shows",
			f: { result: { ok: false, fieldErrors } },
			shown: true,
			toast: null,
		},
		{
			name: "field errors nobody shows",
			f: { result: { ok: false, fieldErrors } },
			toast: "Fallback",
		},
		{
			name: "a bare failure in a form",
			f: { result: { ok: false } },
			shown: true,
			toast: "Fallback",
		},
		{
			name: "a form error beside field errors",
			f: { result: { ok: false, fieldErrors, formError: "Gone" } },
			shown: true,
			toast: "Gone",
		},
	])("$name", ({ f, shown, toast }) => {
		toastFailure(f, "Fallback", { fieldErrorsShown: shown });
		if (toast) expect(toastError).toHaveBeenCalledExactlyOnceWith(toast);
		else expect(toastError).not.toHaveBeenCalled();
	});
});
