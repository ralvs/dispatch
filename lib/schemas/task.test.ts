import { describe, expect, it } from "vitest";
import { CreateTaskFormSchema } from "@/lib/schemas/task";

// The form schema and the capture schema (lib/schemas/capture.ts) validate the
// same concept from different inputs; they share the WallClockTimeSchema leaf
// so a time impossible on one path is impossible on the other too.
describe("CreateTaskFormSchema due_time", () => {
	// A due_date is supplied here so these cases test time-format validity in
	// isolation from the due_time-requires-due_date invariant below.
	const parse = (due_time: string) =>
		CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
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
			due_time: "15:00",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a due_time paired with an empty due_date", () => {
		const result = CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			due_date: "",
			due_time: "15:00",
		});
		expect(result.success).toBe(false);
	});

	it("accepts a due_time paired with a due_date", () => {
		const result = CreateTaskFormSchema.safeParse({
			title: "ligar pro dentista",
			due_date: "2026-08-01",
			due_time: "15:00",
		});
		expect(result.success).toBe(true);
	});
});
