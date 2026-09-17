import { describe, expect, it } from "vitest";
import { CreateTaskActionSchema } from "@/lib/schemas/capture";

const base = { action: "create_task" as const, title: "pagar aluguel" };

describe("CreateTaskActionSchema optional text fields", () => {
	// The measured failure: asked to omit `project`, a small parser model
	// answers with a placeholder instead. Every one of these used to fail
	// z.string().min(1) and take the whole parse — the title, the date and the
	// domain with it — down to the raw text.
	it.each(["", " ", "  ", ":", ",", "-", '""'])(
		"treats the placeholder %j as an omitted field",
		(junk) => {
			const parsed = CreateTaskActionSchema.parse({
				...base,
				project: junk,
				domain: junk,
				notes: junk,
			});
			expect(parsed.project).toBeUndefined();
			expect(parsed.domain).toBeUndefined();
			expect(parsed.notes).toBeUndefined();
		},
	);

	it("keeps a real answer, trimmed", () => {
		const parsed = CreateTaskActionSchema.parse({
			...base,
			project: "  Dispatch  ",
			domain: "Casa",
			notes: "ok",
		});
		expect(parsed).toMatchObject({ project: "Dispatch", domain: "Casa", notes: "ok" });
	});

	it("keeps a one-character answer, which is a name and not a placeholder", () => {
		expect(CreateTaskActionSchema.parse({ ...base, project: "a" }).project).toBe("a");
	});

	it("still rejects a missing title", () => {
		expect(() => CreateTaskActionSchema.parse({ action: "create_task", title: "" })).toThrow();
	});
});
