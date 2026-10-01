import { describe, expect, it } from "vitest";
import { cadenceThresholdDays, withCadenceThresholdDays } from "@/lib/services/domains";

describe("withCadenceThresholdDays", () => {
	it("writes a rule onto a domain that had none", () => {
		expect(withCadenceThresholdDays([], 7)).toEqual([{ rule: "no_activity_days", value: 7 }]);
	});

	it("replaces the value but keeps the existing rule name", () => {
		expect(withCadenceThresholdDays([{ rule: "days_since_journal", value: 14 }], 3)).toEqual([
			{ rule: "days_since_journal", value: 3 },
		]);
	});

	it("leaves rules the editor does not manage alone", () => {
		const patterns = [
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 7 },
		];
		expect(withCadenceThresholdDays(patterns, 10)).toEqual([
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 10 },
		]);
	});

	it("removes the numeric rule when cleared, keeping the rest", () => {
		const patterns = [
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 7 },
		];
		expect(withCadenceThresholdDays(patterns, null)).toEqual([
			{ rule: "no_open_tasks_days", value: 30 },
		]);
	});

	it("survives a malformed failure_patterns value", () => {
		expect(withCadenceThresholdDays(null, 5)).toEqual([{ rule: "no_activity_days", value: 5 }]);
		expect(withCadenceThresholdDays([1, "x", null], 5)).toEqual([
			{ rule: "no_activity_days", value: 5 },
		]);
	});

	it("round-trips through the reader that decides neglect", () => {
		expect(cadenceThresholdDays(withCadenceThresholdDays([], 9))).toBe(9);
		expect(
			cadenceThresholdDays(withCadenceThresholdDays([{ rule: "no_activity_days" }], null)),
		).toBe(null);
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
