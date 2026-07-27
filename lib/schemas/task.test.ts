import { describe, expect, it } from "vitest";
import { CreateTaskFormSchema } from "@/lib/schemas/task";

// The form schema and the capture schema (lib/schemas/capture.ts) validate the
// same concept from different inputs; they share the WallClockTimeSchema leaf
// so a time impossible on one path is impossible on the other too.
describe("CreateTaskFormSchema due_time", () => {
	const parse = (due_time: string) =>
		CreateTaskFormSchema.safeParse({ title: "ligar pro dentista", due_time });

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
