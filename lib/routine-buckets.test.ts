import { describe, expect, it } from "vitest";
import { bucketRoutines } from "@/lib/routine-buckets";
import type { CompletionRow, RoutineRow } from "@/lib/schemas/routine";

const TODAY = "2026-07-15";
const SP = "America/Sao_Paulo";
// Midday in SP (UTC-3) on TODAY — a stable "now" for missed-routine checks.
const NOW_MS = Date.parse(`${TODAY}T15:00:00.000Z`);

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
