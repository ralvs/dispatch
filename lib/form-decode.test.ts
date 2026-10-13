import { describe, expect, it } from "vitest";
import { z } from "zod";
import { decodeFields, decodeForm, formDecoder } from "./form-decode";

function fd(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

const TestSchema = z.object({
	title: z.string().min(1), // required, non-nullable
	notes: z.string().nullable().optional(), // nullable — blank clears
	kind: z.string().optional(), // optional, non-nullable — blank omits
	rating: z.number().nullable().optional(),
	priority: z.number().int().min(1).max(3), // required number
	active: z.boolean().optional(),
});

describe("decodeFields", () => {
	it("clears a nullable field to null when blank", () => {
		const result = decodeFields(TestSchema, fd({ title: "x", notes: "  ", priority: "2" }));
		expect(result.notes).toBeNull();
	});

	it("omits a non-nullable optional field when blank", () => {
		const result = decodeFields(TestSchema, fd({ title: "x", kind: "", priority: "2" }));
		expect("kind" in result).toBe(false);
	});

	it("omits a required field entirely when missing (not sent as blank)", () => {
		const result = decodeFields(TestSchema, fd({ priority: "2" }));
		expect("title" in result).toBe(false);
	});

	it("trims string values", () => {
		const result = decodeFields(TestSchema, fd({ title: "  hello  ", priority: "2" }));
		expect(result.title).toBe("hello");
	});

	it("coerces a number field to a number", () => {
		const spec = { priority: "number", rating: "number" } as const;
		const result = decodeFields(TestSchema, fd({ title: "x", priority: "3", rating: "5" }), spec);
		expect(result.rating).toBe(5);
		expect(result.priority).toBe(3);
	});

	it("blanks a nullable number field to null when non-numeric", () => {
		const spec = { priority: "number", rating: "number" } as const;
		const result = decodeFields(TestSchema, fd({ title: "x", priority: "2", rating: "abc" }), spec);
		expect(result.rating).toBeNull();
	});

	it("omits a required number field when blank (schema.parse will reject)", () => {
		const result = decodeFields(TestSchema, fd({ title: "x", priority: "" }), {
			priority: "number",
		});
		expect("priority" in result).toBe(false);
	});

	it("coerces a boolean field: present+non-empty is true, absent is false", () => {
		const spec = { active: "boolean" } as const;
		const withChecked = decodeFields(
			TestSchema,
			fd({ title: "x", priority: "2", active: "on" }),
			spec,
		);
		expect(withChecked.active).toBe(true);

		const withoutChecked = decodeFields(TestSchema, fd({ title: "x", priority: "2" }), spec);
		expect(withoutChecked.active).toBe(false);
	});
});

const UpdateTestSchema = TestSchema.partial();

describe("decodeFields — absent vs blank", () => {
	it("regression: a partial update schema with only one field submitted returns only that field (no nulls for unsubmitted nullable fields)", () => {
		const result = decodeFields(UpdateTestSchema, fd({ title: "New Title" }));
		expect(result).toEqual({ title: "New Title" });
	});

	it("an absent number field is omitted, not defaulted to null", () => {
		const result = decodeFields(UpdateTestSchema, fd({ title: "x" }), {
			priority: "number",
			rating: "number",
		});
		expect("rating" in result).toBe(false);
		expect("priority" in result).toBe(false);
	});

	it("a present-but-blank nullable field still clears to null", () => {
		const result = decodeFields(UpdateTestSchema, fd({ title: "x", notes: "" }));
		expect(result.notes).toBeNull();
	});

	it("a present-but-blank non-nullable optional field is still omitted", () => {
		const result = decodeFields(UpdateTestSchema, fd({ title: "x", kind: "" }));
		expect("kind" in result).toBe(false);
	});

	it("an absent boolean field still defaults to false — unaffected by the absent/blank distinction", () => {
		const result = decodeFields(UpdateTestSchema, fd({ title: "x" }), { active: "boolean" });
		expect(result.active).toBe(false);
	});

	it("overrides still win over an absent field", () => {
		const result = decodeForm(UpdateTestSchema, fd({ title: "x" }), {
			overrides: { notes: "forced" },
		});
		expect(result.notes).toBe("forced");
	});
});

const NUMERIC_SPEC = { priority: "number", rating: "number", active: "boolean" } as const;

describe("decodeForm", () => {
	it("parses valid input into the schema's typed shape", () => {
		const parsed = decodeForm(TestSchema, fd({ title: "Hello", priority: "1" }), {
			spec: NUMERIC_SPEC,
		});
		expect(parsed).toEqual({
			title: "Hello",
			priority: 1,
			active: false,
		});
	});

	it("throws a ZodError on invalid input, matching pre-existing .parse semantics", () => {
		expect(() => decodeForm(TestSchema, fd({ priority: "2" }), { spec: NUMERIC_SPEC })).toThrow(
			z.ZodError,
		);
	});

	it("lets overrides merge last and win over decoded form fields", () => {
		const parsed = decodeForm(TestSchema, fd({ title: "x", priority: "2", rating: "5" }), {
			spec: NUMERIC_SPEC,
			overrides: { rating: 9, priority: 3 },
		});
		expect(parsed.rating).toBe(9);
		expect(parsed.priority).toBe(3);
	});

	it("respects an explicit FormSpec for number/boolean coercion", () => {
		const parsed = decodeForm(TestSchema, fd({ title: "x", priority: "2", rating: "10" }), {
			spec: NUMERIC_SPEC,
		});
		expect(parsed.rating).toBe(10);
	});
});

describe("list fields", () => {
	const schema = z.object({ tags: z.array(z.string()).optional() });
	const spec = { tags: "list" } as const;

	it("absent → omitted", () => {
		expect(decodeFields(schema, new FormData(), spec)).toEqual({});
	});

	it("blank → []", () => {
		expect(decodeFields(schema, fd({ tags: "" }), spec)).toEqual({ tags: [] });
	});

	it("split, trimmed, empties dropped", () => {
		expect(decodeFields(schema, fd({ tags: " a, ,b " }), spec)).toEqual({ tags: ["a", "b"] });
	});
});

describe("formDecoder", () => {
	const schema = z.object({ title: z.string().min(1), via: z.string().optional() });

	it("read returns null on a refused form without throwing", () => {
		expect(formDecoder(schema).read(new FormData())).toBeNull();
	});

	it("read returns null when a refine throws", () => {
		const throwing = z.object({ title: z.string() }).refine(() => {
			throw new Error("boom");
		});
		expect(formDecoder(throwing).read(fd({ title: "x" }))).toBeNull();
	});

	it("parse throws a ZodError on a refused form", () => {
		expect(() => formDecoder(schema).parse(new FormData())).toThrow(z.ZodError);
	});

	it("fixed overrides merge first, per-call overrides last", () => {
		const d = formDecoder(schema, { overrides: { via: "fixed", title: "fixed" } });
		expect(d.parse(fd({ title: "typed" }))).toEqual({ title: "fixed", via: "fixed" });
		expect(d.read(fd({ title: "typed" }), { via: "call" })).toEqual({
			title: "fixed",
			via: "call",
		});
	});
});
