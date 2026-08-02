import { describe, expect, it } from "vitest";
import type { CalendarEventRow } from "@/lib/services/calendar";
import type { DomainRow } from "@/lib/services/domains";
import type { MilestoneRow, ProjectRow } from "@/lib/services/projects";
import type { QuoteRow } from "@/lib/services/quotes";
import type { CompletionRow, RoutineRow } from "@/lib/services/routines";
import type { TaskRow } from "@/lib/services/tasks";
import {
	assembleDoingToday,
	bucketRoutines,
	buildAnchor,
	buildCadenceLines,
	buildDaySchedule,
	cadenceThresholdDays,
	deriveBriefLines,
	pickResurfaced,
	quoteOfDay,
	summarizeProjects,
} from "@/lib/services/today";

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
			needsReview: 2,
		});

		expect(lines.map((l) => l.key)).toEqual(["overdue", "dueToday", "routines", "needsReview"]);
		expect(lines.map((l) => l.href)).toEqual(["/tasks", "/tasks", "/routines", "/notes"]);
		expect(lines.map((l) => Boolean(l.slip))).toEqual([true, false, false, true]);
		expect(lines.find((l) => l.key === "routines")?.big).toBe("1/4");
	});

	it("omits zero-valued lines, except routines shows whenever total > 0", () => {
		const lines = buildCadenceLines({
			overdue: 0,
			dueToday: 0,
			routinesDone: 0,
			routinesTotal: 3,
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
// Midday in SP (UTC-3) on TODAY — a stable "now" for missed-routine checks.
const NOW_MS = Date.parse(`${TODAY}T15:00:00.000Z`);

function domain(overrides: Partial<DomainRow> & { id: string; name: string }): DomainRow {
	return {
		description: null,
		fruit_definition: null,
		failure_patterns: [{ rule: "no_activity_days", value: 7 }],
		expected_cadence: "Weekly minimum",
		active: true,
		last_shipped_at: null,
		color: null,
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

	it("skips domains without a numeric rule", () => {
		const domains = [domain({ id: "prose", name: "Prose", failure_patterns: "check in weekly" })];
		expect(deriveBriefLines(domains, {}, TODAY, SP)).toHaveLength(0);
	});

	it("surfaces a domain approaching its threshold without marking it slipping", () => {
		// 6 days since touch on a 7-day threshold — past 75%, not yet over.
		const d = domain({ id: "d1", name: "Soon", last_shipped_at: "2026-07-09T12:00:00.000Z" });
		const lines = deriveBriefLines([d], {}, TODAY, SP);
		expect(lines).toHaveLength(1);
		expect(lines[0].slipping).toBe(false);
	});

	it("deep-links each line to its settings domain row", () => {
		const d = domain({
			id: "abc-123",
			name: "Travel",
			last_shipped_at: "2026-06-01T12:00:00.000Z",
		});
		const lines = deriveBriefLines([d], {}, TODAY, SP);
		expect(lines[0].href).toBe("/settings#domain-abc-123");
	});

	it("sets lastTouched for a domain with a real touch", () => {
		const d = domain({ id: "d1", name: "Touched", last_shipped_at: "2026-06-01T12:00:00.000Z" });
		const lines = deriveBriefLines([d], {}, TODAY, SP);
		expect(lines[0].lastTouched).not.toBeNull();
		expect(typeof lines[0].lastTouched).toBe("string");
	});

	it("leaves lastTouched null for a domain that was never touched, while daysSince still runs off created_at", () => {
		const d = domain({
			id: "d1",
			name: "NeverTouched",
			last_shipped_at: null,
			created_at: "2026-06-01T12:00:00.000Z",
		});
		const lines = deriveBriefLines([d], {}, TODAY, SP);
		expect(lines).toHaveLength(1);
		expect(lines[0].lastTouched).toBeNull();
		expect(lines[0].daysSince).toBeGreaterThan(0);
	});
});

describe("bucketRoutines", () => {
	it("groups by time of day in fixed order, dropping empty buckets", () => {
		const routines = [
			routine({ id: "r1", name: "Read", time_of_day: "evening" }),
			routine({ id: "r2", name: "Run", time_of_day: "morning" }),
			routine({ id: "r3", name: "Stretch", time_of_day: "morning" }),
		];
		const buckets = bucketRoutines({
			routines,
			completions: [],
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
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
		const [bucket] = bucketRoutines({
			routines,
			completions,
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0]).toMatchObject({ done: true, streak: 3 });
	});

	it("keeps yesterday's streak alive when today is not done yet", () => {
		const routines = [routine({ id: "r1", name: "Run" })];
		const completions = [completion("r1", "2026-07-13"), completion("r1", "2026-07-14")];
		const [bucket] = bucketRoutines({
			routines,
			completions,
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0]).toMatchObject({ done: false, streak: 2 });
	});

	it("flags a routine as missed when its time has passed and it's not done", () => {
		// NOW_MS is 12:00 SP; 09:00 has already passed.
		const routines = [routine({ id: "r1", name: "Run", specific_time: "09:00:00" })];
		const [bucket] = bucketRoutines({
			routines,
			completions: [],
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0].missed).toBe(true);
	});

	it("is not missed when its time hasn't arrived yet", () => {
		const routines = [routine({ id: "r1", name: "Run", specific_time: "18:00:00" })];
		const [bucket] = bucketRoutines({
			routines,
			completions: [],
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0].missed).toBe(false);
	});

	it("is not missed once done, even past its time", () => {
		const routines = [routine({ id: "r1", name: "Run", specific_time: "09:00:00" })];
		const completions = [completion("r1", TODAY)];
		const [bucket] = bucketRoutines({
			routines,
			completions,
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0].missed).toBe(false);
	});

	it("is not missed when there is no specific time", () => {
		const routines = [routine({ id: "r1", name: "Run", specific_time: null })];
		const [bucket] = bucketRoutines({
			routines,
			completions: [],
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0].missed).toBe(false);
	});

	it("degrades to not-missed for a malformed time, without throwing", () => {
		const routines = [routine({ id: "r1", name: "Run", specific_time: "25:99" })];
		expect(() =>
			bucketRoutines({ routines, completions: [], todayIso: TODAY, tz: SP, nowMs: NOW_MS }),
		).not.toThrow();
		const [bucket] = bucketRoutines({
			routines,
			completions: [],
			todayIso: TODAY,
			tz: SP,
			nowMs: NOW_MS,
		});
		expect(bucket.rows[0].missed).toBe(false);
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

describe("buildDaySchedule", () => {
	// SP is UTC-3 year-round (Brazil dropped DST in 2019), so 14:00Z reads 11:00.
	function schedule(events: CalendarEventRow[], openTasks: TaskRow[]) {
		return buildDaySchedule({ events, openTasks, dateIso: TODAY, tz: SP });
	}

	it("returns three empty bands for an empty day", () => {
		const day = schedule([], []);
		expect(day.allDay).toEqual([]);
		expect(day.timeline).toEqual([]);
		expect(day.open).toEqual([]);
	});

	it("puts all-day events and untimed due tasks in the all-day band", () => {
		const day = schedule(
			[event({ id: "e1", all_day: true })],
			[task({ id: "t1", due_date: TODAY })],
		);
		expect(day.allDay.map((i) => i.key)).toEqual(["event:e1", "task:t1"]);
		expect(day.allDay.map((i) => i.time)).toEqual([null, null]);
		expect(day.timeline).toEqual([]);
		expect(day.open).toEqual([]);
	});

	it("merges timed events and timed tasks into one ascending timeline", () => {
		const day = schedule(
			[
				event({ id: "late", start_at: `${TODAY}T20:00:00.000Z` }),
				event({ id: "early", start_at: `${TODAY}T12:00:00.000Z` }),
			],
			[task({ id: "mid", due_date: TODAY, due_time: "14:30" })],
		);
		expect(day.timeline.map((i) => i.key)).toEqual(["event:early", "task:mid", "event:late"]);
		expect(day.timeline.map((i) => i.time)).toEqual(["09:00", "14:30", "17:00"]);
	});

	it("reads the HH:MM:SS form a Postgres time column returns", () => {
		const day = schedule([], [task({ id: "t1", due_date: TODAY, due_time: "08:15:00" })]);
		expect(day.timeline.map((i) => i.time)).toEqual(["08:15"]);
	});

	it("demotes a task with an unparseable time to the all-day band", () => {
		const day = schedule([], [task({ id: "t1", due_date: TODAY, due_time: "sometime" })]);
		expect(day.allDay.map((i) => i.key)).toEqual(["task:t1"]);
		expect(day.timeline).toEqual([]);
	});

	it("breaks equal times events-first, then by title", () => {
		const day = schedule(
			[event({ id: "e", title: "Standup", start_at: `${TODAY}T13:00:00.000Z` })],
			[
				task({ id: "z", title: "Zebra", due_date: TODAY, due_time: "10:00" }),
				task({ id: "a", title: "Apple", due_date: TODAY, due_time: "10:00" }),
			],
		);
		expect(day.timeline.map((i) => i.key)).toEqual(["event:e", "task:a", "task:z"]);
	});

	it("keeps an event that began yesterday ahead of today's timed items", () => {
		const day = schedule(
			[
				event({
					id: "spillover",
					start_at: "2026-07-14T22:00:00.000Z",
					end_at: `${TODAY}T14:00:00.000Z`,
				}),
				event({ id: "morning", start_at: `${TODAY}T12:00:00.000Z` }),
			],
			[],
		);
		expect(day.timeline.map((i) => i.key)).toEqual(["event:spillover", "event:morning"]);
	});

	it("lifts starred tasks into Top 3 and leaves the rest in open", () => {
		const day = schedule(
			[],
			[
				task({ id: "old", due_date: "2026-07-01" }),
				task({ id: "later", due_date: "2026-08-01" }),
				task({ id: "star", top3_for_date: TODAY }),
			],
		);
		expect(day.top3.map((t) => t.id)).toEqual(["star"]);
		// "later" isn't due yet, so it stays off the day entirely.
		expect(day.open.map((t) => t.id)).toEqual(["old"]);
	});

	it("never repeats a task that already has a place on the day", () => {
		const timed = task({ id: "t1", due_date: TODAY, due_time: "09:00" });
		const day = schedule([], [timed]);
		expect(day.timeline).toHaveLength(1);
		expect(day.open).toEqual([]);
		expect(day.top3).toEqual([]);
	});

	// Deliberate overlap: the timeline answers "when", Top 3 answers "what
	// matters". A shortlist that dropped a task for having a clock time would
	// misreport the day.
	it("keeps a starred timed task on the timeline AND in Top 3", () => {
		const timed = task({ id: "t1", due_date: TODAY, due_time: "09:00", top3_for_date: TODAY });
		const day = schedule([], [timed]);
		expect(day.timeline).toHaveLength(1);
		expect(day.top3.map((t) => t.id)).toEqual(["t1"]);
		expect(day.open).toEqual([]);
	});

	it("caps the open band at 10", () => {
		const tasks = Array.from({ length: 15 }, (_, i) =>
			task({ id: `t${i}`, due_date: "2026-07-01" }),
		);
		expect(schedule([], tasks).open).toHaveLength(10);
	});

	it("never caps Top 3 — a fourth star is surfaced, not hidden", () => {
		const tasks = Array.from({ length: 4 }, (_, i) => task({ id: `t${i}`, top3_for_date: TODAY }));
		expect(schedule([], tasks).top3).toHaveLength(4);
	});

	it("leaves a task due on another day off every band", () => {
		const day = schedule([], [task({ id: "t1", due_date: "2026-07-16", due_time: "09:00" })]);
		expect(day.allDay).toEqual([]);
		expect(day.timeline).toEqual([]);
		expect(day.top3).toEqual([]);
		expect(day.open).toEqual([]);
	});
});
