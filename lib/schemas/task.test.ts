import { describe, expect, it } from "vitest";
import { CreateTaskFormSchema } from "@/lib/schemas/task";

const DOMAIN = "11111111-1111-4111-8111-111111111111";

// The form schema and the capture schema (lib/schemas/capture.ts) validate the
// same concept from different inputs; they share the WallClockTimeSchema leaf
// so a time impossible on one path is impossible on the other too.
describe("CreateTaskFormSchema due_time", () => {
	// A due_date is supplied here so these cases test time-format validity in
	// isolation from the due_time-requires-due_date invariant below.
	const parse = (due_time: string) =>
		CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			// Mandatory since the task form stopped offering "Unfiled" — every
			// fixture here has to carry one or it fails for the wrong reason.
			domain_id: DOMAIN,
			due_date: "2026-08-01",
			due_time,
		});

	it.each(["99:99", "24:00", "12:60", "7:30", "0730"])("rejects %s", (value) => {
		expect(parse(value).success).toBe(false);
	});

	it.each(["00:00", "09:05", "15:00", "23:59"])("accepts %s", (value) => {
		expect(parse(value).success).toBe(true);
	});

	// FormData yields "" for an unset field rather than omitting it.
	it("accepts the empty string for an unset time", () => {
		expect(parse("").success).toBe(true);
	});
});

// A time with no date to put it on is meaningless (matches the DB check
// constraint). This is the form-side half of the invariant; lib/services/tasks.test.ts
// covers the service-side coercion for both createTask and updateTask.
describe("CreateTaskFormSchema due_time-requires-due_date invariant", () => {
	it("rejects a due_time with no due_date", () => {
		const result = CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			domain_id: DOMAIN,
			due_time: "15:00",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a due_time paired with an empty due_date", () => {
		const result = CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			domain_id: DOMAIN,
			due_date: "",
			due_time: "15:00",
		});
		expect(result.success).toBe(false);
	});

	it("accepts a due_time paired with a due_date", () => {
		const result = CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			domain_id: DOMAIN,
			due_date: "2026-08-01",
			due_time: "15:00",
		});
		expect(result.success).toBe(true);
	});
});

describe("CreateTaskFormSchema · project_id", () => {
	const base = { title: "Ship it", priority: "3", domain_id: DOMAIN };

	it("accepts a project id", () => {
		const parsed = CreateTaskFormSchema.parse({
			...base,
			project_id: "3f1b6c2e-9a4d-4f7b-8c1e-2d5a6b7c8d9e",
		});
		expect(parsed.project_id).toBe("3f1b6c2e-9a4d-4f7b-8c1e-2d5a6b7c8d9e");
	});

	it("accepts the empty string a cleared select posts", () => {
		expect(CreateTaskFormSchema.parse({ ...base, project_id: "" }).project_id).toBe("");
	});

	it("rejects anything that is not a uuid", () => {
		expect(CreateTaskFormSchema.safeParse({ ...base, project_id: "nope" }).success).toBe(false);
	});
});

describe("CreateTaskFormSchema · domain_id", () => {
	const base = { title: "Ship it", priority: "3" };

	// The one field the form may not leave blank. `required` on the select is
	// browser-side only; this is where the rule actually holds.
	it("rejects a missing domain", () => {
		expect(CreateTaskFormSchema.safeParse(base).success).toBe(false);
	});

	it("rejects the empty string a blank select would post", () => {
		expect(CreateTaskFormSchema.safeParse({ ...base, domain_id: "" }).success).toBe(false);
	});

	it("accepts a domain id", () => {
		expect(CreateTaskFormSchema.safeParse({ ...base, domain_id: DOMAIN }).success).toBe(true);
	});
});

describe("CreateTaskFormSchema · priority", () => {
	const base = { title: "Ship it", domain_id: DOMAIN };

	it("accepts 1–3, defaults to 3 (low), and rejects 4", () => {
		for (const p of ["1", "2", "3"]) {
			expect(CreateTaskFormSchema.safeParse({ ...base, priority: p }).success).toBe(true);
		}
		const parsed = CreateTaskFormSchema.safeParse(base);
		expect(parsed.success && parsed.data.priority).toBe(3);
		expect(CreateTaskFormSchema.safeParse({ ...base, priority: "4" }).success).toBe(false);
	});
});
