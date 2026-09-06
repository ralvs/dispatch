import { describe, expect, it } from "vitest";
import type { RoutineStats } from "@/lib/routine-stats";
import { routineStats } from "./routine-stats-band";

function stats(patch: Partial<RoutineStats> = {}): RoutineStats {
	return {
		current_streak: 0,
		longest_streak: 0,
		completions_7d: 0,
		completions_30d: 0,
		total: 0,
		done_today: false,
		...patch,
	};
}

describe("routineStats", () => {
	it("rates against routines × days, not days", () => {
		// Three routines, one kept every day for 7 days: 7 / (3 × 7) = 33%.
		const band = routineStats([stats({ completions_7d: 7 }), stats(), stats()]);
		expect(band[1]).toMatchObject({ value: "33%", label: "kept · last 7" });
	});

	it("is 100% when every routine was kept every day", () => {
		const band = routineStats([stats({ completions_30d: 30 }), stats({ completions_30d: 30 })]);
		expect(band[0].value).toBe("100%");
	});

	it("shows a dash rather than dividing by zero", () => {
		expect(routineStats([])[0].value).toBe("—");
	});

	it("reports the longest current streak", () => {
		const band = routineStats([stats({ current_streak: 4 }), stats({ current_streak: 11 })]);
		expect(band[2]).toMatchObject({ value: 11, label: "day streak" });
	});

	it("never spends the orange", () => {
		expect(routineStats([stats()]).every((s) => !s.attention)).toBe(true);
	});
});
