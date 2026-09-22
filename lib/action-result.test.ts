import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { formValues, fromZodError, runFormAction } from "./action-result";

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

const Schema = z.object({ name: z.string().min(1, "Name it."), age: z.coerce.number().int() });

describe("fromZodError", () => {
	it("puts each issue under the field it names", () => {
		const result = Schema.safeParse({ name: "", age: "x" });
		if (result.success) throw new Error("expected failure");
		const failure = fromZodError(result.error);
		expect(failure.ok).toBe(false);
		expect(failure.fieldErrors?.name).toEqual(["Name it."]);
		expect(failure.fieldErrors?.age).toHaveLength(1);
		expect(failure.formError).toBeUndefined();
	});

	it("turns an issue with no path into a form error", () => {
		const result = z.uuid().safeParse("nope");
		if (result.success) throw new Error("expected failure");
		const failure = fromZodError(result.error);
		expect(failure.fieldErrors).toBeUndefined();
		expect(failure.formError).toBeTypeOf("string");
	});
});

describe("formValues", () => {
	it("echoes string fields and drops files and React's own keys", () => {
		const fd = form({ name: "Bia", $ACTION_ID_abc: "" });
		fd.set("photo", new File(["x"], "x.png"));
		expect(formValues(fd)).toEqual({ name: "Bia" });
	});
});

describe("runFormAction", () => {
	it("wraps a result in ok", async () => {
		await expect(runFormAction(form({}), async () => 42)).resolves.toEqual({ ok: true, data: 42 });
	});

	it("returns field errors and the submitted values on a ZodError", async () => {
		const fd = form({ name: "", age: "3" });
		const result = await runFormAction(fd, async () => Schema.parse(Object.fromEntries(fd)));
		expect(result).toMatchObject({
			ok: false,
			fieldErrors: { name: ["Name it."] },
			values: { name: "", age: "3" },
		});
	});

	it("turns any other failure into a generic form error", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await runFormAction(form({ name: "x" }), async () => {
			throw new Error("db down");
		});
		expect(result).toMatchObject({
			ok: false,
			formError: expect.any(String),
			values: { name: "x" },
		});
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("rethrows redirect and notFound", async () => {
		await expect(
			runFormAction(form({}), async () => {
				redirect("/sign-in");
			}),
		).rejects.toThrow();
	});
});
