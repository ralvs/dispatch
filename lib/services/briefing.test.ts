import { describe, expect, it } from "vitest";
import {
	assembleDoingToday,
	bucketRoutines,
	buildAnchor,
	buildCadenceLines,
	cadenceThresholdDays,
	deriveBriefLines,
	pickResurfaced,
	quoteOfDay,
	summarizeProjects,
} from "@/lib/services/briefing";
import type { CalendarEventRow } from "@/lib/services/calendar";
import type { DomainRow } from "@/lib/services/domains";
import type { MilestoneRow, ProjectRow } from "@/lib/services/projects";
import type { QuoteRow } from "@/lib/services/quotes";
import type { CompletionRow, RoutineRow } from "@/lib/services/routines";
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

const SP = "America/Sao_Paulo";

function domain(overrides: Partial<DomainRow> & { id: string; name: string }): DomainRow {
	return {
		description: null,
		fruit_definition: null,
		failure_patterns: [{ rule: "no_activity_days", value: 7 }],
		expected_cadence: "Weekly minimum",
		active: true,
		is_system: false,
		last_shipped_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as DomainRow;
}

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

function routine(overrides: Partial<RoutineRow> & { id: string; name: string }): RoutineRow {
	return {
		description: null,
		position: 0,
		active: true,
		time_of_day: "anytime",
		specific_time: null,
		reminder_enabled: false,
		last_reminder_sent_date: null,
		goal_days: null,
		archived_at: null,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	} as RoutineRow;
}

function completion(routineId: string, dateIso: string): CompletionRow {
	return {
		id: `${routineId}-${dateIso}`,
		routine_id: routineId,
		completed_date: dateIso,
		created_at: `${dateIso}T12:00:00.000Z`,
	};
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

describe("cadenceThresholdDays", () => {
	it("reads the numeric no_activity_days / days_since_journal rule", () => {
		expect(cadenceThresholdDays([{ rule: "no_activity_days", value: 7 }])).toBe(7);
		expect(cadenceThresholdDays([{ rule: "days_since_journal", value: 3 }])).toBe(3);
	});

	it("returns null for malformed or missing shapes", () => {
		expect(cadenceThresholdDays(null)).toBeNull();
		expect(cadenceThresholdDays("weekly")).toBeNull();
		expect(cadenceThresholdDays([])).toBeNull();
		expect(cadenceThresholdDays([{ rule: "no_activity_days", value: "7" }])).toBeNull();
		expect(cadenceThresholdDays([{ rule: "unknown_rule", value: 7 }])).toBeNull();
		expect(cadenceThresholdDays([{ rule: "no_activity_days", value: 0 }])).toBeNull();
	});
});

describe("deriveBriefLines", () => {
	it("flags a domain past its threshold as slipping, most-slipped first", () => {
		const domains = [
			domain({ id: "d1", name: "Barely", last_shipped_at: "2026-07-08T12:00:00.000Z" }),
			domain({ id: "d2", name: "Badly", last_shipped_at: "2026-06-15T12:00:00.000Z" }),
		];
		const lines = deriveBriefLines(domains, {}, TODAY, SP);
		expect(lines.map((l) => l.name)).toEqual(["Badly", "Barely"]);
		expect(lines[0].slipping).toBe(true);
		expect(lines[0].daysSince).toBe(30);
		expect(lines[0].thresholdDays).toBe(7);
	});

	it("uses the most recent of last_shipped_at and last completed task", () => {
		const d = domain({ id: "d1", name: "Fresh", last_shipped_at: "2026-06-01T12:00:00.000Z" });
		const lines = deriveBriefLines([d], { d1: "2026-07-14T12:00:00.000Z" }, TODAY, SP);
		expect(lines).toHaveLength(0); // touched yesterday — nowhere near threshold
	});

	it("skips system domains and domains without a numeric rule", () => {
		const domains = [
			domain({ id: "inbox", name: "Inbox", is_system: true }),
			domain({ id: "prose", name: "Prose", failure_patterns: "check in weekly" }),
		];
		expect(deriveBriefLines(domains, {}, TODAY, SP)).toHaveLength(0);
	});

	it("surfaces a domain approaching its threshold without marking it slipping", () => {
		// 6 days since touch on a 7-day threshold — past 75%, not yet over.
		const d = domain({ id: "d1", name: "Soon", last_shipped_at: "2026-07-09T12:00:00.000Z" });
		const lines = deriveBriefLines([d], {}, TODAY, SP);
		expect(lines).toHaveLength(1);
		expect(lines[0].slipping).toBe(false);
	});
});

describe("bucketRoutines", () => {
	it("groups by time of day in fixed order, dropping empty buckets", () => {
		const routines = [
			routine({ id: "r1", name: "Read", time_of_day: "evening" }),
			routine({ id: "r2", name: "Run", time_of_day: "morning" }),
			routine({ id: "r3", name: "Stretch", time_of_day: "morning" }),
		];
		const buckets = bucketRoutines(routines, [], TODAY);
		expect(buckets.map((b) => b.bucket)).toEqual(["morning", "evening"]);
		expect(buckets[0].rows.map((r) => r.name)).toEqual(["Run", "Stretch"]);
	});

	it("computes done-today and current streak from completion history", () => {
		const routines = [routine({ id: "r1", name: "Run", time_of_day: "morning" })];
		const completions = [
			completion("r1", "2026-07-13"),
			completion("r1", "2026-07-14"),
			completion("r1", TODAY),
		];
		const [bucket] = bucketRoutines(routines, completions, TODAY);
		expect(bucket.rows[0]).toMatchObject({ done: true, streak: 3 });
	});

	it("keeps yesterday's streak alive when today is not done yet", () => {
		const routines = [routine({ id: "r1", name: "Run" })];
		const completions = [completion("r1", "2026-07-13"), completion("r1", "2026-07-14")];
		const [bucket] = bucketRoutines(routines, completions, TODAY);
		expect(bucket.rows[0]).toMatchObject({ done: false, streak: 2 });
	});
});

describe("summarizeProjects", () => {
	function milestone(
		overrides: Partial<MilestoneRow> & { id: string; project_id: string },
	): MilestoneRow {
		return {
			title: "Milestone",
			status: "open",
			weight: 1,
			position: 0,
			completed_at: null,
			created_at: "2026-01-01T00:00:00.000Z",
			...overrides,
		} as MilestoneRow;
	}

	it("computes weighted progress and the next open milestone", () => {
		const projects = [{ id: "p1", name: "Dispatch" } as ProjectRow];
		const milestones = {
			p1: [
				milestone({ id: "m1", project_id: "p1", status: "done", weight: 3 }),
				milestone({ id: "m2", project_id: "p1", title: "Ship UI", weight: 1 }),
			],
		};
		const [brief] = summarizeProjects(projects, milestones);
		expect(brief.progress).toBeCloseTo(0.75);
		expect(brief.nextMilestone).toEqual({ title: "Ship UI" });
	});

	it("handles projects with no milestones", () => {
		const [brief] = summarizeProjects([{ id: "p1", name: "Empty" } as ProjectRow], {});
		expect(brief.progress).toBe(0);
		expect(brief.nextMilestone).toBeNull();
	});
});
