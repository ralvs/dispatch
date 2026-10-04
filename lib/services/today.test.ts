import { describe, expect, it } from "vitest";
import type { CalendarEventRow } from "@/lib/services/calendar";
import type { ProjectRow } from "@/lib/services/projects";
import type { QuoteRow } from "@/lib/services/quotes";
import { buildAnchor, pickResurfaced, quoteOfDay, summarizeProjects } from "@/lib/services/today";

const TODAY = "2026-07-15";

function quote(id: string, text = "text"): QuoteRow {
	return {
		id,
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

function event(overrides: Partial<CalendarEventRow> & { id: string }): CalendarEventRow {
	return {
		title: "Event",
		description: null,
		start_at: `${TODAY}T14:00:00.000Z`,
		end_at: `${TODAY}T15:00:00.000Z`,
		all_day: false,
		location: null,
		calendar_name: null,
		attendees: [],
		source: "caldav",
		...overrides,
	} as CalendarEventRow;
}

describe("pickResurfaced", () => {
	const quotes = [quote("a"), quote("b"), quote("c")];

	it("matches quoteOfDay when nothing is skipped", () => {
		expect(pickResurfaced(quotes, TODAY, [])?.id).toBe(quoteOfDay(quotes, TODAY)?.id);
	});

	it("advances past skipped ids, wrapping around the list", () => {
		const first = pickResurfaced(quotes, TODAY, []);
		if (!first) throw new Error("expected a pick");
		const second = pickResurfaced(quotes, TODAY, [first.id]);
		expect(second).not.toBeNull();
		expect(second?.id).not.toBe(first.id);
	});

	it("returns null when every quote has been skipped", () => {
		expect(pickResurfaced(quotes, TODAY, ["a", "b", "c"])).toBeNull();
	});

	it("returns null for an empty list", () => {
		expect(pickResurfaced([], TODAY, [])).toBeNull();
	});
});

describe("buildAnchor", () => {
	it("picks the next upcoming timed event and carries the counts", () => {
		const events = [
			event({ id: "past", start_at: `${TODAY}T10:00:00.000Z` }),
			event({ id: "allday", all_day: true }),
			event({ id: "next", title: "Standup", start_at: `${TODAY}T16:00:00.000Z` }),
			event({ id: "later", start_at: `${TODAY}T20:00:00.000Z` }),
		];
		const anchor = buildAnchor({
			events,
			openCount: 5,
			overdueCount: 2,
			nowUtcIso: `${TODAY}T12:00:00.000Z`,
		});
		expect(anchor.eventCount).toBe(4);
		expect(anchor.nextEvent).toEqual({ startAt: `${TODAY}T16:00:00.000Z`, title: "Standup" });
		expect(anchor.openCount).toBe(5);
		expect(anchor.overdueCount).toBe(2);
	});

	it("has no next event when everything already started", () => {
		const anchor = buildAnchor({
			events: [event({ id: "past", start_at: `${TODAY}T10:00:00.000Z` })],
			openCount: 0,
			overdueCount: 0,
			nowUtcIso: `${TODAY}T12:00:00.000Z`,
		});
		expect(anchor.nextEvent).toBeNull();
	});
});

describe("summarizeProjects", () => {
	it("counts done over total from the project's own tasks", () => {
		const projects = [{ id: "p1", name: "Dispatch" } as ProjectRow];
		const [brief] = summarizeProjects(projects, { p1: { done: 3, open: 1 } });
		expect(brief.progress).toBeCloseTo(0.75);
		expect(brief.doneCount).toBe(3);
		expect(brief.totalCount).toBe(4);
	});

	it("handles projects with no tasks", () => {
		const [brief] = summarizeProjects([{ id: "p1", name: "Empty" } as ProjectRow], {});
		expect(brief.progress).toBe(0);
		expect(brief.totalCount).toBe(0);
	});
});
