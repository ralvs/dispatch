import { describe, expect, it } from "vitest";
import { parseMetadata } from "@/lib/links/metadata";

// parseMetadata is the pure half of the fetcher — fetchLinkMetadata itself is
// the network edge and is left to manual verification, like lib/caldav/client.

describe("parseMetadata", () => {
	it("prefers og:title over <title>", () => {
		const html = `<head><title>Site name</title><meta property="og:title" content="The real headline"></head>`;
		expect(parseMetadata(html).title).toBe("The real headline");
	});

	it("falls back to <title> when no meta tags exist", () => {
		expect(parseMetadata("<head><title>Just a title</title></head>").title).toBe("Just a title");
	});

	it("reads content before property, whichever order the attributes come in", () => {
		const html = `<head><meta content="Backwards" property="og:title"></head>`;
		expect(parseMetadata(html).title).toBe("Backwards");
	});

	it("matches description by name as well as property", () => {
		const html = `<head><meta name="description" content="A summary."></head>`;
		expect(parseMetadata(html).description).toBe("A summary.");
	});

	it("decodes entities, leaving a bare ampersand intact", () => {
		const html = `<head><title>Tom &amp; Jerry &lt;3 &#233;</title></head>`;
		expect(parseMetadata(html).title).toBe("Tom & Jerry <3 é");
	});

	it("collapses the whitespace a pretty-printed <title> carries", () => {
		const html = "<head><title>\n\t Spread   out \n</title></head>";
		expect(parseMetadata(html).title).toBe("Spread out");
	});

	it("returns nulls for a document with no metadata at all", () => {
		expect(parseMetadata("<html><body>hi</body></html>")).toEqual({
			title: null,
			description: null,
		});
	});

	it("treats an empty content attribute as absent", () => {
		const html = `<head><meta property="og:title" content="   "><title>Fallback</title></head>`;
		expect(parseMetadata(html).title).toBe("Fallback");
	});

	it("ignores a <title> that appears after </head>", () => {
		const html = `<head><meta name="description" content="d"></head><body><title>Not this</title></body>`;
		expect(parseMetadata(html).title).toBeNull();
	});
});
