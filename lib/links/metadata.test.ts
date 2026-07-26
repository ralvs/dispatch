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

	describe("article headline vs. page title", () => {
		it("drops the masthead declared by og:site_name", () => {
			const html = `<head><meta property="og:site_name" content="The Verge"><title>How the deal fell apart — The Verge</title></head>`;
			expect(parseMetadata(html).title).toBe("How the deal fell apart");
		});

		it("drops a masthead that only matches the host", () => {
			const html = "<head><title>How the deal fell apart | Reuters</title></head>";
			expect(parseMetadata(html, "www.reuters.com").title).toBe("How the deal fell apart");
		});

		it("trims the brand off og:title as well", () => {
			const html = `<head><meta property="og:title" content="A quiet week in review | Stratechery"></head>`;
			expect(parseMetadata(html, "stratechery.com").title).toBe("A quiet week in review");
		});

		it("keeps a dash that is part of the headline", () => {
			const html = "<head><title>Rust 2.0 — what changed and why</title></head>";
			expect(parseMetadata(html, "example.com").title).toBe("Rust 2.0 — what changed and why");
		});

		it("finds the brand under a subdomain", () => {
			const html = "<head><title>Neuromancer - Wikipedia</title></head>";
			expect(parseMetadata(html, "en.wikipedia.org").title).toBe("Neuromancer");
		});

		it("leaves a tail that is not the site alone", () => {
			const html = "<head><title>Y Combinator | Hacker News</title></head>";
			expect(parseMetadata(html, "news.ycombinator.com").title).toBe("Y Combinator | Hacker News");
		});

		it("keeps the whole title when stripping would leave a stub", () => {
			const html = "<head><title>Home | Reuters</title></head>";
			expect(parseMetadata(html, "reuters.com").title).toBe("Home | Reuters");
		});
	});
});
