import { describe, expect, it } from "vitest";
import { taskStats } from "./task-stats-band";

const TZ = "America/Sao_Paulo";
const TODAY = "2026-09-06";
const QUIET = new Set(["paused-project"]);

function open(
	patch: Partial<{ project_id: string | null; due_date: string | null; created_at: string }> = {},
) {
	return {
		project_id: null,
		due_date: null,
		created_at: "2026-09-06T12:00:00.000Z",
		...patch,
	};
}

function done(completedAt: string | null) {
	return { completed_at: completedAt };
}

describe("taskStats", () => {
	it("counts recent done inside the 3-day window, not older", () => {
		const band = taskStats(
			[],
			[
				done("2026-09-06T15:00:00.000Z"),
				done("2026-09-04T15:00:00.000Z"),
				done("2026-09-03T15:00:00.000Z"),
			],
			TODAY,
			TZ,
			QUIET,
		);
		expect(band[0]).toMatchObject({ value: 2, label: "done · last 3d" });
	});

	it("counts dated open work due today through +6d, and skips overdue", () => {
		const band = taskStats(
			[
				open({ due_date: TODAY }),
				open({ due_date: "2026-09-12" }),
				open({ due_date: "2026-09-13" }),
				open({ due_date: "2026-09-01" }),
			],
			[],
			TODAY,
			TZ,
			QUIET,
		);
		expect(band[1]).toMatchObject({ value: 2, label: "due · 7d" });
	});

	it("still counts a dated task in a quiet project — a due date always wins", () => {
		const band = taskStats(
			[open({ due_date: TODAY, project_id: "paused-project" })],
			[],
			TODAY,
			TZ,
			QUIET,
		);
		expect(band[1]).toMatchObject({ value: 1, label: "due · 7d" });
	});

	it("reports the oldest open task's age in days", () => {
		const band = taskStats(
			[
				open({ created_at: "2026-09-05T12:00:00.000Z" }),
				open({ created_at: "2026-08-23T12:00:00.000Z" }),
			],
			[],
			TODAY,
			TZ,
			QUIET,
		);
		expect(band[2]).toMatchObject({ value: "14d", label: "oldest open" });
	});

	it("shows a dash when nothing is open, and ignores quiet tasks", () => {
		expect(taskStats([], [], TODAY, TZ, QUIET)[2].value).toBe("—");
		expect(
			taskStats(
				[open({ project_id: "paused-project", created_at: "2026-01-01T00:00:00.000Z" })],
				[],
				TODAY,
				TZ,
				QUIET,
			)[2].value,
		).toBe("—");
	});

	it("counts an undated task with no project — it is never quiet", () => {
		expect(
			taskStats([open({ created_at: "2026-09-05T12:00:00.000Z" })], [], TODAY, TZ, QUIET)[2].value,
		).toBe("1d");
	});

	it("never spends the orange", () => {
		const band = taskStats(
			[open({ due_date: "2026-01-01" }), open({ created_at: "2025-01-01T00:00:00.000Z" })],
			[],
			TODAY,
			TZ,
			QUIET,
		);
		expect(band.every((s) => !s.attention)).toBe(true);
	});
});
