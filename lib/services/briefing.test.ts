import { describe, expect, it } from "vitest";
import { assembleDoingToday, buildCadenceLines, quoteOfDay } from "@/lib/services/briefing";
import type { QuoteRow } from "@/lib/services/quotes";
import type { TaskRow } from "@/lib/services/tasks";

const TODAY = "2026-07-15";

function quote(id: string, text = "text"): QuoteRow {
	return {
		id,
		book_id: null,
		text,
		page_number: null,
		chapter: null,
		source_type: null,
		source_reference: null,
		source_url: null,
		source_author: null,
		tags: [],
		added_via: "manual",
		last_surfaced_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
	} as QuoteRow;
}

function task(overrides: Partial<TaskRow> & { id: string }): TaskRow {
	return {
		title: "Task",
		status: "open",
		notes: null,
		due_date: null,
		due_time: null,
		priority: 3,
		domain_id: "domain-1",
		project_id: null,
		recurrence_rule: null,
		top3_for_date: null,
		source: "manual",
		completed_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		domain: null,
		project: null,
		...overrides,
	} as TaskRow;
}

describe("quoteOfDay", () => {
	it("returns null for an empty list", () => {
		expect(quoteOfDay([], TODAY)).toBeNull();
	});

	it("is stable for the same day", () => {
		const quotes = [quote("a"), quote("b"), quote("c")];
		const first = quoteOfDay(quotes, TODAY);
		const second = quoteOfDay(quotes, TODAY);
		expect(first?.id).toBe(second?.id);
	});

	it("is order-insensitive — sorts by id before picking", () => {
		const quotes = [quote("a"), quote("b"), quote("c")];
		const shuffled = [quote("c"), quote("a"), quote("b")];
		expect(quoteOfDay(quotes, TODAY)?.id).toBe(quoteOfDay(shuffled, TODAY)?.id);
	});

	it("picks at least two distinct quotes across a week with five quotes", () => {
		const quotes = [quote("a"), quote("b"), quote("c"), quote("d"), quote("e")];
		const picks = new Set<string>();
		for (let i = 0; i < 7; i++) {
			const dateIso = `2026-07-${String(10 + i).padStart(2, "0")}`;
			const picked = quoteOfDay(quotes, dateIso);
			if (picked) picks.add(picked.id);
		}
		expect(picks.size).toBeGreaterThanOrEqual(2);
	});
});

describe("buildCadenceLines", () => {
	it("returns all lines in order with correct keys/hrefs/slip for a full input", () => {
		const lines = buildCadenceLines({
			overdue: 2,
			dueToday: 3,
			routinesDone: 1,
			routinesTotal: 4,
			readingCount: 1,
			needsReview: 2,
		});

		expect(lines.map((l) => l.key)).toEqual([
			"overdue",
			"dueToday",
			"routines",
			"reading",
			"needsReview",
		]);
		expect(lines.map((l) => l.href)).toEqual(["/tasks", "/tasks", "/routines", "/books", "/notes"]);
		expect(lines.map((l) => Boolean(l.slip))).toEqual([true, false, false, false, true]);
		expect(lines.find((l) => l.key === "routines")?.big).toBe("1/4");
	});

	it("omits zero-valued lines, except routines shows whenever total > 0", () => {
		const lines = buildCadenceLines({
			overdue: 0,
			dueToday: 0,
			routinesDone: 0,
			routinesTotal: 3,
			readingCount: 0,
			needsReview: 0,
		});
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({ key: "routines", big: "0/3" });
	});

	it("omits routines entirely when total is 0", () => {
		const lines = buildCadenceLines({
			overdue: 0,
			dueToday: 0,
			routinesDone: 0,
			routinesTotal: 0,
			readingCount: 0,
			needsReview: 0,
		});
		expect(lines).toHaveLength(0);
	});
});

describe("assembleDoingToday", () => {
	it("puts starred top-3 tasks first, then due/overdue non-top3 tasks", () => {
		const starred = task({ id: "t1", top3_for_date: TODAY });
		const due = task({ id: "t2", due_date: TODAY });
		const overdue = task({ id: "t3", due_date: "2026-07-01" });

		const result = assembleDoingToday([due, overdue, starred], TODAY);

		expect(result[0].id).toBe("t1");
		expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(["t1", "t2", "t3"]));
	});

	it("excludes non-top3 tasks with no due date or a future due date", () => {
		const noDueDate = task({ id: "t1" });
		const future = task({ id: "t2", due_date: "2026-08-01" });

		const result = assembleDoingToday([noDueDate, future], TODAY);

		expect(result).toHaveLength(0);
	});

	it("caps the result at 10", () => {
		const tasks = Array.from({ length: 15 }, (_, i) => task({ id: `t${i}`, top3_for_date: TODAY }));

		const result = assembleDoingToday(tasks, TODAY);

		expect(result).toHaveLength(10);
	});

	it("never duplicates a task that is both starred and due today", () => {
		const both = task({ id: "t1", top3_for_date: TODAY, due_date: TODAY });

		const result = assembleDoingToday([both], TODAY);

		expect(result).toHaveLength(1);
	});
});
