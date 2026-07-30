import { describe, expect, it } from "vitest";
import {
	formatReminderOffset,
	MAX_REMINDERS_PER_TICK,
	planReminders,
	REMINDER_CATCHUP_MINUTES,
	type ReminderCandidate,
	reminderMessage,
} from "./reminders";

const SP = "America/Sao_Paulo"; // UTC-3, no DST since 2019
const NY = "America/New_York"; // DST-having zone

function task(overrides: Partial<ReminderCandidate> & { id: string }): ReminderCandidate {
	return {
		title: "Task",
		due_date: null,
		due_time: null,
		reminders_sent: {},
		...overrides,
	};
}

describe("planReminders", () => {
	it("never fires a task with no due_date", () => {
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: null })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse("2026-07-14T18:00:00.000Z"),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([]);
		expect(plan.suppress).toEqual([]);
		expect(plan.sentByTask).toEqual({});
	});

	it("neither fires nor suppresses a reminder that isn't due yet, and writes no marker", () => {
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-07-14", due_time: "15:00" })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse("2026-07-14T17:00:00.000Z"), // 1h before due
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([]);
		expect(plan.suppress).toEqual([]);
		expect(plan.sentByTask).toEqual({});
	});

	it("offset 0 with a due_time fires exactly at the due instant (default path)", () => {
		const fireAt = "2026-07-14T18:00:00.000Z"; // 15:00 SP
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-07-14", due_time: "15:00" })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse(fireAt),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([
			{ taskId: "t1", title: "Task", fireAtUtc: fireAt, dueDate: "2026-07-14", dueTime: "15:00" },
		]);
		expect(plan.sentByTask).toEqual({ t1: { due: "2026-07-14" } });
	});

	it("anchors at reminder_anchor_time when due_time is null", () => {
		const fireAt = "2026-07-14T12:00:00.000Z"; // 09:00 SP anchor
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-07-14", due_time: null })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse(fireAt),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toHaveLength(1);
		expect(plan.fire[0]?.fireAtUtc).toBe(fireAt);
	});

	it("subtracts a non-zero offset correctly across a UTC day boundary (DST-having zone)", () => {
		// 00:30 America/New_York on 2026-01-15 = 05:30Z. A 6h (360min) offset
		// pushes the fire instant back into 2026-01-14 in UTC.
		const fireAt = "2026-01-14T23:30:00.000Z";
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-01-15", due_time: "00:30" })],
			tz: NY,
			todayIso: "2026-01-14",
			nowMs: Date.parse(fireAt),
			offsetMinutes: 360,
			anchorTime: "09:00",
		});
		expect(plan.fire[0]?.fireAtUtc).toBe(fireAt);
	});

	it("skips a reminder already sent for the same due_date", () => {
		const plan = planReminders({
			tasks: [
				task({
					id: "t1",
					due_date: "2026-07-14",
					due_time: "15:00",
					reminders_sent: { due: "2026-07-14" },
				}),
			],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse("2026-07-14T18:00:00.000Z"),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([]);
		expect(plan.suppress).toEqual([]);
		expect(plan.sentByTask).toEqual({});
	});

	it("fires again after a recurring roll changed due_date (sent value is now stale)", () => {
		const plan = planReminders({
			tasks: [
				task({
					id: "t1",
					due_date: "2026-07-21", // rolled forward a week
					due_time: "15:00",
					reminders_sent: { due: "2026-07-14" }, // stale — last occurrence
				}),
			],
			tz: SP,
			todayIso: "2026-07-21",
			nowMs: Date.parse("2026-07-21T18:00:00.000Z"),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toHaveLength(1);
		expect(plan.sentByTask).toEqual({ t1: { due: "2026-07-21" } });
	});

	it("does not re-fire an already-sent reminder when the global offset changes", () => {
		// Sent under whatever offset was active at the time; offsetMinutes here
		// is different, but dedupe is keyed on due_date only.
		const plan = planReminders({
			tasks: [
				task({
					id: "t1",
					due_date: "2026-07-14",
					due_time: "15:00",
					reminders_sent: { due: "2026-07-14" },
				}),
			],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse("2026-07-14T18:00:00.000Z"),
			offsetMinutes: 30, // changed from whatever fired it
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([]);
	});

	it("suppresses (marks sent without delivering) a reminder beyond the catch-up window", () => {
		const dueInstant = "2026-07-14T18:00:00.000Z";
		const nowMs = Date.parse(dueInstant) + (REMINDER_CATCHUP_MINUTES + 10) * 60_000;
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-07-14", due_time: "15:00" })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs,
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toEqual([]);
		expect(plan.suppress).toHaveLength(1);
		expect(plan.suppress[0]?.taskId).toBe("t1");
		expect(plan.sentByTask).toEqual({ t1: { due: "2026-07-14" } });
	});

	it("degrades a malformed due_time to the anchor time instead of throwing", () => {
		const fireAt = "2026-07-14T12:00:00.000Z"; // 09:00 SP anchor
		const plan = planReminders({
			tasks: [task({ id: "t1", due_date: "2026-07-14", due_time: "not-a-time" })],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse(fireAt),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toHaveLength(1);
		expect(plan.fire[0]?.fireAtUtc).toBe(fireAt);
	});

	it("degrades malformed reminders_sent (treated as not-yet-sent) instead of throwing", () => {
		const fireAt = "2026-07-14T18:00:00.000Z";
		const plan = planReminders({
			tasks: [
				task({
					id: "t1",
					due_date: "2026-07-14",
					due_time: "15:00",
					reminders_sent: "garbage",
				}),
			],
			tz: SP,
			todayIso: "2026-07-14",
			nowMs: Date.parse(fireAt),
			offsetMinutes: 0,
			anchorTime: "09:00",
		});
		expect(plan.fire).toHaveLength(1);
	});

	it("caps fires at maxPerTick, leaving the remainder with no marker at all", () => {
		const nowMs = Date.parse("2026-07-14T18:00:00.000Z");
		const tasks = Array.from({ length: MAX_REMINDERS_PER_TICK + 3 }, (_, i) =>
			task({ id: `t${i}`, due_date: "2026-07-14", due_time: "15:00" }),
		);
		const plan = planReminders({
			tasks,
			tz: SP,
			todayIso: "2026-07-14",
			nowMs,
			offsetMinutes: 0,
			anchorTime: "09:00",
			maxPerTick: MAX_REMINDERS_PER_TICK,
		});
		expect(plan.fire).toHaveLength(MAX_REMINDERS_PER_TICK);
		expect(plan.suppress).toEqual([]);
		expect(Object.keys(plan.sentByTask)).toHaveLength(MAX_REMINDERS_PER_TICK);
	});
});

describe("formatReminderOffset", () => {
	it("formats boundary values", () => {
		expect(formatReminderOffset(0)).toBe("At the time");
		expect(formatReminderOffset(5)).toBe("5 minutes before");
		expect(formatReminderOffset(30)).toBe("30 minutes before");
		expect(formatReminderOffset(60)).toBe("1 hour before");
		expect(formatReminderOffset(120)).toBe("2 hours before");
		expect(formatReminderOffset(1440)).toBe("1 day before");
	});
});

// This copy is what actually lands in the push banner, so it is asserted
// rather than left to whatever the raw columns happen to stringify to.
describe("reminderMessage", () => {
	const base = { title: "Send the deposit", dueDate: "2026-07-24" };

	it("reads as a sentence for a timed task at the due moment", () => {
		expect(reminderMessage({ ...base, dueTime: "17:21:00", offsetMinutes: 0 })).toEqual({
			title: "Send the deposit",
			body: "Due now, at 17:21.",
		});
	});

	it("names the clock time and the lead time for an early reminder", () => {
		expect(reminderMessage({ ...base, dueTime: "17:21:00", offsetMinutes: 30 }).body).toBe(
			"Due at 17:21 — 30 minutes before.",
		);
	});

	it("never leaks a Postgres fractional-second time into the banner", () => {
		expect(reminderMessage({ ...base, dueTime: "17:21:13.709561", offsetMinutes: 0 }).body).toBe(
			"Due now, at 17:21.",
		);
	});

	it("omits a clock time the task does not have", () => {
		expect(reminderMessage({ ...base, dueTime: null, offsetMinutes: 0 }).body).toBe("Due today.");
		expect(reminderMessage({ ...base, dueTime: null, offsetMinutes: 60 }).body).toBe(
			"Due today — 1 hour before.",
		);
	});
});
