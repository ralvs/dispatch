import { describe, expect, it } from "vitest";
import { previewFromText, roleForNodeName, TICK_MAX_PX, tickThickness } from "./layout";

describe("tick rail geometry", () => {
	it("never emits a scrollbar thumb", () => {
		expect(tickThickness(false)).toBeLessThan(TICK_MAX_PX);
		expect(tickThickness(true)).toBeLessThan(TICK_MAX_PX);
	});

	it("maps editor nodes to Grok-style roles", () => {
		expect(roleForNodeName("heading")).toBe("Heading");
		expect(roleForNodeName("paragraph")).toBe("Paragraph");
		expect(roleForNodeName("taskList")).toBe("List");
		expect(roleForNodeName("hardBreak")).toBeNull();
	});

	it("compacts preview text", () => {
		expect(previewFromText("  hello\n\nworld  ")).toBe("hello world");
		expect(previewFromText("a".repeat(80)).endsWith("…")).toBe(true);
	});
});
