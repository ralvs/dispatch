import { describe, expect, it } from "vitest";
import type { CalendarEventRow } from "@/lib/schemas/calendar";
import type { TaskRow } from "@/lib/schemas/task";
import type { DaySchedule, DayScheduleItem, DaySchedulePayload } from "@/lib/services/briefing";
import {
	type DayCacheEntry,
	daySignature,
	keysToEvict,
	REVALIDATE_AFTER_MS,
	readDay,
	reconcileDay,
} from "./revalidation";

function task(partial: Partial<TaskRow> & Pick<TaskRow, "id" | "title">): TaskRow {
	return {
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 4,
		project_id: null,
		domain_id: "domain-1",
		recurrence_rule: null,
		top3_for_date: null,
		source: "manual",
		created_at: "2026-07-01T12:00:00.000Z",
		completed_at: null,
		domain: { id: "domain-1", name: "Engine", color: null },
		project: null,
		...partial,
	};
}

function event(
	partial: Partial<CalendarEventRow> & Pick<CalendarEventRow, "id" | "title">,
): CalendarEventRow {
	return {
		description: null,
		start_at: "2026-07-31T12:00:00.000Z",
		end_at: "2026-07-31T13:00:00.000Z",
		all_day: false,
		location: null,
		calendar_name: "Work",
		attendees: [],
		source: "caldav",
		...partial,
	};
}

function taskItem(t: TaskRow, time: string | null = null): DayScheduleItem {
	return { kind: "task", key: `task-${t.id}`, sortAt: "", time, task: t };
}

function eventItem(e: CalendarEventRow, time: string | null = null): DayScheduleItem {
	return { kind: "event", key: `event-${e.id}`, sortAt: "", time, event: e };
}

function schedule(partial: Partial<DaySchedule> = {}): DaySchedule {
	return { allDay: [], timeline: [], top3: [], open: [], ...partial };
}

function payload(partial: Partial<DaySchedulePayload> = {}): DaySchedulePayload {
	return {
		schedule: schedule(),
		dateIso: "2026-07-31",
		nowUtcIso: "2026-07-31T14:30:12.004Z",
		nowLabel: "14:30",
		eventNoteIds: {},
		taskNoteIds: {},
		...partial,
	};
}

function entry(p: DaySchedulePayload, fetchedAtMs: number): DayCacheEntry {
	return { payload: p, signature: daySignature(p), fetchedAtMs };
}

describe("daySignature", () => {
	it("is identical across sub-minute nowUtcIso drift", () => {
		const a = daySignature(payload({ nowUtcIso: "2026-07-31T14:30:00.004Z" }));
		const b = daySignature(payload({ nowUtcIso: "2026-07-31T14:30:59.999Z" }));
		expect(a).toEqual(b);
	});

	it("differs once nowUtcIso crosses a minute", () => {
		const a = daySignature(payload({ nowUtcIso: "2026-07-31T14:30:59.999Z" }));
		const b = daySignature(payload({ nowUtcIso: "2026-07-31T14:31:00.000Z" }));
		expect(a).not.toEqual(b);
	});

	it("is identical when eventNoteIds is built with a different key insertion order", () => {
		const a = daySignature(payload({ eventNoteIds: { a: "n1", b: "n2" } }));
		const b = daySignature(payload({ eventNoteIds: { b: "n2", a: "n1" } }));
		expect(a).toEqual(b);
	});

	it("differs when a task's status changes open to done", () => {
		const t1 = task({ id: "t", title: "T" });
		const t2 = task({ id: "t", title: "T", status: "done" });
		const a = daySignature(payload({ schedule: schedule({ open: [t1] }) }));
		const b = daySignature(payload({ schedule: schedule({ open: [t2] }) }));
		expect(a).not.toEqual(b);
	});

	it("differs when top3_for_date toggles", () => {
		const t1 = task({ id: "t", title: "T" });
		const t2 = task({ id: "t", title: "T", top3_for_date: "2026-07-31" });
		const a = daySignature(payload({ schedule: schedule({ open: [t1] }) }));
		const b = daySignature(payload({ schedule: schedule({ open: [t2] }) }));
		expect(a).not.toEqual(b);
	});

	it("differs when an event's end_at shifts", () => {
		const e1 = event({ id: "e", title: "E", end_at: "2026-07-31T13:00:00.000Z" });
		const e2 = event({ id: "e", title: "E", end_at: "2026-07-31T14:00:00.000Z" });
		const a = daySignature(payload({ schedule: schedule({ timeline: [eventItem(e1, "12:00")] }) }));
		const b = daySignature(payload({ schedule: schedule({ timeline: [eventItem(e2, "12:00")] }) }));
		expect(a).not.toEqual(b);
	});

	it("differs when an item is appended to allDay", () => {
		const t1 = task({ id: "t1", title: "One" });
		const t2 = task({ id: "t2", title: "Two" });
		const a = daySignature(payload({ schedule: schedule({ allDay: [taskItem(t1)] }) }));
		const b = daySignature(
			payload({ schedule: schedule({ allDay: [taskItem(t1), taskItem(t2)] }) }),
		);
		expect(a).not.toEqual(b);
	});

	it("differs when the timeline is reordered", () => {
		const t1 = task({ id: "t1", title: "One" });
		const t2 = task({ id: "t2", title: "Two" });
		const a = daySignature(
			payload({ schedule: schedule({ timeline: [taskItem(t1, "09:00"), taskItem(t2, "10:00")] }) }),
		);
		const b = daySignature(
			payload({ schedule: schedule({ timeline: [taskItem(t2, "10:00"), taskItem(t1, "09:00")] }) }),
		);
		expect(a).not.toEqual(b);
	});

	it("differs when a taskNoteIds entry is added", () => {
		const a = daySignature(payload({ taskNoteIds: {} }));
		const b = daySignature(payload({ taskNoteIds: { t1: "note-1" } }));
		expect(a).not.toEqual(b);
	});

	it("differs between nowLabel null and a real label", () => {
		const a = daySignature(payload({ nowLabel: null }));
		const b = daySignature(payload({ nowLabel: "14:30" }));
		expect(a).not.toEqual(b);
	});

	it("is stable and does not throw on an all-empty schedule", () => {
		expect(() => daySignature(payload())).not.toThrow();
		expect(daySignature(payload())).toEqual(daySignature(payload()));
	});
});

describe("daySignature / SoftRefresh interplay", () => {
	it("differs for two today payloads 5 minutes apart with identical schedule content", () => {
		const a = daySignature(payload({ nowUtcIso: "2026-07-31T14:30:00.000Z", nowLabel: "14:30" }));
		const b = daySignature(payload({ nowUtcIso: "2026-07-31T14:35:00.000Z", nowLabel: "14:35" }));
		expect(a).not.toEqual(b);
	});

	it("is identical for the same pair on a non-today day (nowLabel null)", () => {
		const a = daySignature(
			payload({ dateIso: "2026-08-01", nowUtcIso: "2026-07-31T14:30:00.000Z", nowLabel: null }),
		);
		const b = daySignature(
			payload({ dateIso: "2026-08-01", nowUtcIso: "2026-07-31T14:35:00.000Z", nowLabel: null }),
		);
		expect(a).toEqual(b);
	});

	it("still differs off-today 5 minutes apart when a task was added", () => {
		const t = task({ id: "t", title: "New" });
		const a = daySignature(
			payload({
				dateIso: "2026-08-01",
				nowUtcIso: "2026-07-31T14:30:00.000Z",
				nowLabel: null,
				schedule: schedule({ open: [] }),
			}),
		);
		const b = daySignature(
			payload({
				dateIso: "2026-08-01",
				nowUtcIso: "2026-07-31T14:35:00.000Z",
				nowLabel: null,
				schedule: schedule({ open: [t] }),
			}),
		);
		expect(a).not.toEqual(b);
	});
});

describe("content vs. time split", () => {
	it("a pure clock advance on today changes time but not content", () => {
		const a = daySignature(payload({ nowUtcIso: "2026-07-31T14:30:00.000Z", nowLabel: "14:30" }));
		const b = daySignature(payload({ nowUtcIso: "2026-07-31T14:35:00.000Z", nowLabel: "14:35" }));
		expect(a.time).not.toEqual(b.time);
		expect(a.content).toEqual(b.content);
	});

	it("a task added with the clock held fixed changes content but not time", () => {
		const t = task({ id: "t", title: "New" });
		const a = daySignature(payload({ schedule: schedule({ open: [] }) }));
		const b = daySignature(payload({ schedule: schedule({ open: [t] }) }));
		expect(a.content).not.toEqual(b.content);
		expect(a.time).toEqual(b.time);
	});
});

describe("readDay", () => {
	it("misses on an empty cache", () => {
		const cache = new Map<string, DayCacheEntry>();
		expect(readDay(cache, "2026-07-31", 0)).toEqual({ kind: "miss" });
	});

	it("hits without revalidation at 30s old", () => {
		const cache = new Map([["2026-07-31", entry(payload(), 0)]]);
		const decision = readDay(cache, "2026-07-31", 30_000);
		expect(decision.kind).toBe("hit");
		expect(decision.kind === "hit" && decision.revalidate).toBe(false);
	});

	it("hits with revalidation at 90s old", () => {
		const cache = new Map([["2026-07-31", entry(payload(), 0)]]);
		const decision = readDay(cache, "2026-07-31", 90_000);
		expect(decision.kind).toBe("hit");
		expect(decision.kind === "hit" && decision.revalidate).toBe(true);
	});

	it("revalidates exactly at the REVALIDATE_AFTER_MS boundary", () => {
		const cache = new Map([["2026-07-31", entry(payload(), 0)]]);
		const decision = readDay(cache, "2026-07-31", REVALIDATE_AFTER_MS);
		expect(decision.kind === "hit" && decision.revalidate).toBe(true);
	});

	it("is still a hit at 10 minutes old — never a skeleton for seen content", () => {
		const cache = new Map([["2026-07-31", entry(payload(), 0)]]);
		const decision = readDay(cache, "2026-07-31", 10 * 60_000);
		expect(decision.kind).toBe("hit");
	});

	it("honours an explicit revalidateAfterMs override", () => {
		const cache = new Map([["2026-07-31", entry(payload(), 0)]]);
		const decision = readDay(cache, "2026-07-31", 5_000, 10_000);
		expect(decision.kind === "hit" && decision.revalidate).toBe(false);
		const later = readDay(cache, "2026-07-31", 10_000, 10_000);
		expect(later.kind === "hit" && later.revalidate).toBe(true);
	});
});

describe("reconcileDay", () => {
	it("does not adopt when the visible day's signature is unchanged", () => {
		const sig = daySignature(payload());
		expect(
			reconcileDay({
				incomingSignature: sig,
				incomingDateIso: "2026-07-31",
				visibleDateIso: "2026-07-31",
				visibleSignature: sig,
			}),
		).toEqual({ store: true, adopt: false });
	});

	it("adopts when the visible day's signature changed", () => {
		const before = daySignature(payload());
		const after = daySignature(payload({ nowLabel: "15:00" }));
		expect(
			reconcileDay({
				incomingSignature: after,
				incomingDateIso: "2026-07-31",
				visibleDateIso: "2026-07-31",
				visibleSignature: before,
			}),
		).toEqual({ store: true, adopt: true });
	});

	it("stores but does not adopt a changed signature for a day that isn't visible", () => {
		const before = daySignature(payload());
		const after = daySignature(payload({ nowLabel: "15:00" }));
		expect(
			reconcileDay({
				incomingSignature: after,
				incomingDateIso: "2026-08-01",
				visibleDateIso: "2026-07-31",
				visibleSignature: before,
			}),
		).toEqual({ store: true, adopt: false });
	});
});

describe("keysToEvict", () => {
	function cacheOf(entries: Record<string, number>): Map<string, DayCacheEntry> {
		return new Map(
			Object.entries(entries).map(([key, fetchedAtMs]) => [key, entry(payload(), fetchedAtMs)]),
		);
	}

	it("evicts nothing when at or under max", () => {
		const cache = cacheOf({ a: 1, b: 2 });
		expect(keysToEvict(cache, 2, "a")).toEqual([]);
		expect(keysToEvict(cache, 5, "a")).toEqual([]);
	});

	it("evicts oldest-first when over max", () => {
		const cache = cacheOf({ a: 3, b: 1, c: 2 });
		expect(keysToEvict(cache, 1, "zzz-not-in-cache")).toEqual(["b", "c"]);
	});

	it("excludes protect even when it is oldest, evicting the next-oldest instead", () => {
		const cache = cacheOf({ a: 3, b: 1, c: 2 });
		expect(keysToEvict(cache, 1, "b")).toEqual(["c", "a"]);
	});
});
