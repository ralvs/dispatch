import { describe, expect, it } from "vitest";
import { bareUrl } from "@/app/api/capture/route";

// The whole routing decision of POST /api/capture: a bare URL is a bookmark,
// anything else is a capture (docs/adr/0022).

describe("bareUrl", () => {
	it("accepts a lone https URL", () => {
		expect(bareUrl("https://example.com/post")).toBe("https://example.com/post");
	});

	it("accepts it with the whitespace a share sheet appends", () => {
		expect(bareUrl("  https://example.com/post\n")).toBe("https://example.com/post");
	});

	it("un-escapes the &amp; a share sheet puts in the query", () => {
		expect(bareUrl("https://x.com/a/status/1?s=12&amp;t=abc")).toBe(
			"https://x.com/a/status/1?s=12&t=abc",
		);
	});

	it("rejects a sentence that merely contains a link", () => {
		expect(bareUrl("read this before Friday https://example.com/post")).toBeNull();
	});

	it("rejects a URL with a trailing comment", () => {
		expect(bareUrl("https://example.com good one")).toBeNull();
	});

	it("rejects non-http schemes", () => {
		expect(bareUrl("javascript:alert(1)")).toBeNull();
		expect(bareUrl("mailto:renan@alves.id")).toBeNull();
		expect(bareUrl("file:///etc/passwd")).toBeNull();
	});

	it("rejects a bare domain with no scheme, which is likelier a note", () => {
		expect(bareUrl("example.com")).toBeNull();
	});

	it("rejects ordinary capture text", () => {
		expect(bareUrl("ligar pro médico amanhã")).toBeNull();
	});
});
