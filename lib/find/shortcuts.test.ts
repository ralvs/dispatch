import { describe, expect, it } from "vitest";
import { isFindShortcut } from "./shortcuts";

describe("isFindShortcut", () => {
	it("matches Cmd+K and Ctrl+K", () => {
		expect(isFindShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
		expect(isFindShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);
	});

	it("does not steal Capture's J or a plain K", () => {
		expect(isFindShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(false);
		expect(isFindShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
	});
});
