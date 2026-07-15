import { describe, expect, it } from "vitest";
import { isOpenShortcut, isSubmitShortcut } from "@/lib/capture/shortcuts";

describe("isOpenShortcut", () => {
	it("matches Cmd+J", () => {
		expect(isOpenShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(true);
	});

	it("matches Ctrl+J", () => {
		expect(isOpenShortcut({ key: "j", metaKey: false, ctrlKey: true })).toBe(true);
	});

	it("is case-insensitive on the key", () => {
		expect(isOpenShortcut({ key: "J", metaKey: true, ctrlKey: false })).toBe(true);
	});

	it("ignores J without a modifier", () => {
		expect(isOpenShortcut({ key: "j", metaKey: false, ctrlKey: false })).toBe(false);
	});

	it("ignores other modified keys", () => {
		expect(isOpenShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(false);
	});
});

describe("isSubmitShortcut", () => {
	it("matches Cmd/Ctrl+Enter", () => {
		expect(isSubmitShortcut({ key: "Enter", metaKey: true, ctrlKey: false })).toBe(true);
		expect(isSubmitShortcut({ key: "Enter", metaKey: false, ctrlKey: true })).toBe(true);
	});

	it("ignores a bare Enter", () => {
		expect(isSubmitShortcut({ key: "Enter", metaKey: false, ctrlKey: false })).toBe(false);
	});
});
