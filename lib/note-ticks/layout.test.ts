import { describe, expect, it } from "vitest";
import {
	activeIndexForScroll,
	blocksOverflow,
	maxTicksForHeight,
	previewFromText,
	roleForNodeName,
	scrollTopForTick,
	TICK_MAX_PX,
	TICK_MIN_WINDOW,
	TICK_WIDTH_PX,
	tickThickness,
	tickWidth,
	tickWindow,
} from "./layout";

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

	it("lengthens only the active dash", () => {
		expect(tickWidth(false)).toBe(TICK_WIDTH_PX);
		expect(tickWidth(true)).toBeGreaterThan(TICK_WIDTH_PX);
	});
});

describe("tick rail windowing", () => {
	it("keeps a floor so a short rail is still navigable", () => {
		expect(maxTicksForHeight(0)).toBe(TICK_MIN_WINDOW);
		expect(maxTicksForHeight(900)).toBeGreaterThan(TICK_MIN_WINDOW);
	});

	it("shows every dash when they all fit", () => {
		expect(tickWindow(5, 2, 10)).toEqual({ start: 0, end: 5 });
	});

	it("centres the window on the active dash", () => {
		expect(tickWindow(100, 50, 10)).toEqual({ start: 45, end: 55 });
	});

	it("clamps at both ends so the first and last block stay reachable", () => {
		expect(tickWindow(100, 0, 10)).toEqual({ start: 0, end: 10 });
		expect(tickWindow(100, 99, 10)).toEqual({ start: 90, end: 100 });
	});
});

describe("tick rail visibility", () => {
	it("hides the rail when the indexed blocks fit", () => {
		expect(blocksOverflow(500, 900)).toBe(false);
	});

	it("shows the rail once the blocks outrun the scroller", () => {
		expect(blocksOverflow(2000, 900)).toBe(true);
	});

	it("leaves a margin, so a near-exact fit still hides", () => {
		expect(blocksOverflow(870, 900)).toBe(false);
		expect(blocksOverflow(890, 900)).toBe(true);
	});
});

describe("tick rail scroll mapping", () => {
	const tops = [0, 400, 800, 1200];

	it("owns the block crossing the reading line", () => {
		expect(activeIndexForScroll(tops, 0, 1000)).toBe(0);
		expect(activeIndexForScroll(tops, 300, 1000)).toBe(1);
		expect(activeIndexForScroll(tops, 900, 1000)).toBe(3);
	});

	it("is safe on an empty note", () => {
		expect(activeIndexForScroll([], 0, 1000)).toBe(0);
	});

	it("claims the last dash at the bottom of the note", () => {
		expect(activeIndexForScroll(tops, 600, 1000, 1600)).toBe(3);
	});

	it("parks a jumped block on the reading line", () => {
		const target = scrollTopForTick(1200, 1000);
		expect(activeIndexForScroll(tops, target, 1000)).toBe(3);
	});

	it("never scrolls above the top of the note", () => {
		expect(scrollTopForTick(0, 1000)).toBe(0);
	});
});
