import { describe, expect, it } from "vitest";
import { isOpenShortcut, isSubmitShortcut, navShortcutIndex } from "@/lib/capture/shortcuts";

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

describe("navShortcutIndex", () => {
	it("matches Option+1 through Option+5 by event.code", () => {
		for (let i = 1; i <= 5; i++) {
			expect(
				navShortcutIndex({ code: `Digit${i}`, altKey: true, metaKey: false, ctrlKey: false }),
			).toBe(i - 1);
		}
	});

	it("matches on macOS even though Option+1 produces the character ¡, not 1", () => {
		// event.key would be "¡" here, but navShortcutIndex never looks at key —
		// it matches event.code, which stays "Digit1" regardless of what
		// character the OS composes for the modified keypress.
		expect(navShortcutIndex({ code: "Digit1", altKey: true, metaKey: false, ctrlKey: false })).toBe(
			0,
		);
	});

	it("ignores digits without Alt/Option", () => {
		expect(
			navShortcutIndex({ code: "Digit1", altKey: false, metaKey: false, ctrlKey: false }),
		).toBeNull();
	});

	it("ignores Alt+digit combined with Cmd or Ctrl", () => {
		expect(
			navShortcutIndex({ code: "Digit1", altKey: true, metaKey: true, ctrlKey: false }),
		).toBeNull();
		expect(
			navShortcutIndex({ code: "Digit1", altKey: true, metaKey: false, ctrlKey: true }),
		).toBeNull();
	});

	it("ignores codes outside Digit1-5", () => {
		expect(
			navShortcutIndex({ code: "Digit6", altKey: true, metaKey: false, ctrlKey: false }),
		).toBeNull();
		expect(
			navShortcutIndex({ code: "Digit0", altKey: true, metaKey: false, ctrlKey: false }),
		).toBeNull();
		expect(
			navShortcutIndex({ code: "KeyJ", altKey: true, metaKey: false, ctrlKey: false }),
		).toBeNull();
	});
});
