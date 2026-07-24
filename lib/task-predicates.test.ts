import { describe, expect, it } from "vitest";
import { isDueToday, isOverdue, isTop3Today } from "@/lib/task-predicates";

describe("isOverdue", () => {
	it("is false when due today", () => {
		expect(isOverdue({ status: "open", due_date: "2026-07-15" }, "2026-07-15")).toBe(false);
	});

	it("is true when due date is before today", () => {
		expect(isOverdue({ status: "open", due_date: "2026-07-14" }, "2026-07-15")).toBe(true);
	});

	it("is false when due date is after today", () => {
		expect(isOverdue({ status: "open", due_date: "2026-07-16" }, "2026-07-15")).toBe(false);
	});

	it("is false when there is no due date", () => {
		expect(isOverdue({ status: "open", due_date: null }, "2026-07-15")).toBe(false);
	});

	it("is false when the task is already done, even if the due date passed", () => {
		expect(isOverdue({ status: "done", due_date: "2026-07-01" }, "2026-07-15")).toBe(false);
	});
});

describe("isDueToday", () => {
	it("is true when due today", () => {
		expect(isDueToday({ status: "open", due_date: "2026-07-15" }, "2026-07-15")).toBe(true);
	});

	it("is false when due yesterday", () => {
		expect(isDueToday({ status: "open", due_date: "2026-07-14" }, "2026-07-15")).toBe(false);
	});

	it("is false when due tomorrow", () => {
		expect(isDueToday({ status: "open", due_date: "2026-07-16" }, "2026-07-15")).toBe(false);
	});

	it("is false when there is no due date", () => {
		expect(isDueToday({ status: "open", due_date: null }, "2026-07-15")).toBe(false);
	});

	it("is false when the task is already done, even if due today", () => {
		expect(isDueToday({ status: "done", due_date: "2026-07-15" }, "2026-07-15")).toBe(false);
	});
});

describe("isTop3Today", () => {
	it("is true when pinned to today's date", () => {
		expect(isTop3Today({ top3_for_date: "2026-07-15" }, "2026-07-15")).toBe(true);
	});

	it("is false when pinned to a different date", () => {
		expect(isTop3Today({ top3_for_date: "2026-07-14" }, "2026-07-15")).toBe(false);
	});

	it("is false when not pinned", () => {
		expect(isTop3Today({ top3_for_date: null }, "2026-07-15")).toBe(false);
	});
});
