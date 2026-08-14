import { describe, expect, it } from "vitest";
import { buildDaySchedule } from "@/lib/day-schedule";
import type { CalendarEventRow } from "@/lib/schemas/calendar";
import type { TaskRow } from "@/lib/schemas/task";

const TODAY = "2026-07-15";
const SP = "America/Sao_Paulo";

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

	// The day is a record of what happened on it (docs/adr/0038): completing a
	// task must not erase it from the band it was standing on.
	describe("tasks completed on the day", () => {
		function withDone(openTasks: TaskRow[], completedTasks: TaskRow[]) {
			return buildDaySchedule({
				events: [],
				openTasks,
				completedTasks,
				dateIso: TODAY,
				tz: SP,
			});
		}

		function done(overrides: Partial<TaskRow> & { id: string }): TaskRow {
			return task({
				status: "done",
				completed_at: `${TODAY}T13:00:00.000Z`,
				...overrides,
			});
		}

		it("keeps a task due today on the timeline at its due time", () => {
			const day = withDone([], [done({ id: "t1", due_date: TODAY, due_time: "09:00" })]);
			expect(day.timeline.map((i) => i.key)).toEqual(["task:t1"]);
			expect(day.timeline.map((i) => i.time)).toEqual(["09:00"]);
			expect(day.open).toEqual([]);
		});

		it("keeps an untimed task due today in the all-day band", () => {
			const day = withDone([], [done({ id: "t1", due_date: TODAY })]);
			expect(day.allDay.map((i) => i.key)).toEqual(["task:t1"]);
		});

		it("keeps an overdue task closed today in the open band", () => {
			const day = withDone([], [done({ id: "t1", due_date: "2026-07-10" })]);
			expect(day.open.map((t) => t.id)).toEqual(["t1"]);
		});

		it("keeps a starred task closed today in Top 3", () => {
			const day = withDone([], [done({ id: "t1", top3_for_date: TODAY })]);
			expect(day.top3.map((t) => t.id)).toEqual(["t1"]);
		});

		it("adds nothing that was never on the day — no due date, not starred", () => {
			const day = withDone([], [done({ id: "t1" })]);
			expect(day.allDay).toEqual([]);
			expect(day.timeline).toEqual([]);
			expect(day.top3).toEqual([]);
			expect(day.open).toEqual([]);
		});

		it("sinks done rows below open ones and spends none of the open cap", () => {
			const open = Array.from({ length: 10 }, (_, i) =>
				task({ id: `open${i}`, due_date: "2026-07-01" }),
			);
			const day = withDone(open, [done({ id: "closed", due_date: "2026-07-01" })]);
			expect(day.open).toHaveLength(11);
			expect(day.open.at(-1)?.id).toBe("closed");
		});
	});
});
