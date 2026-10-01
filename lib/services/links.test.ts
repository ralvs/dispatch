import { describe, expect, it } from "vitest";
import { CreateLinkSchema } from "@/lib/schemas/link";

// The schema is pure and stays a unit test. Every service write and read runs
// against the local database in links.int.test.ts (#18).

describe("CreateLinkSchema", () => {
	it("accepts a bare url with no metadata", () => {
		expect(CreateLinkSchema.parse({ url: "https://example.com/post" }).url).toBe(
			"https://example.com/post",
		);
	});

	it("rejects a javascript: payload even though it parses as a URL", () => {
		expect(CreateLinkSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
	});

	it("rejects anything that is not a URL at all", () => {
		expect(CreateLinkSchema.safeParse({ url: "not a link" }).success).toBe(false);
	});
});
