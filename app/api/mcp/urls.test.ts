import { describe, expect, it } from "vitest";
import { extractUrls } from "./urls";

describe("extractUrls", () => {
	it("finds links across texts, once each, without trailing punctuation", () => {
		expect(
			extractUrls(
				"See https://example.com/a.",
				"and (http://x.io/b?q=1), then https://example.com/a again",
				null,
			),
		).toEqual(["https://example.com/a", "http://x.io/b?q=1"]);
	});

	it("answers an empty list for text with no link", () => {
		expect(extractUrls("no links here", undefined)).toEqual([]);
	});
});
