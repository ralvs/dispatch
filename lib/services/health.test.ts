import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	addLabResult,
	createLabPanel,
	createMedication,
	createMetric,
	createVisit,
	createWellbeingCheckIn,
	createWorkout,
	deleteLabPanel,
	deleteMetric,
	deleteWorkout,
	listLabPanels,
	setMedicationActive,
} from "@/lib/services/health";

// Stub covering .from().insert().select().single(), .from().update().eq(),
// and .from().delete().eq().
function stubSupabase() {
	const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
	const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
	let deleted = false;

	const sb = {
		from: vi.fn((table: string) => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push({ table, row });
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "row-1", ...row }, error: null })),
					})),
				};
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updates.push({ table, patch });
				return {
					eq: vi.fn(async () => ({ data: null, error: null })),
				};
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async () => {
					deleted = true;
					return { data: null, error: null };
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, updates, wasDeleted: () => deleted };
}

describe("createMetric", () => {
	it("stores the reading verbatim against the given metric name", async () => {
		const { sb, inserts } = stubSupabase();

		const metric = await createMetric(sb, {
			measured_at: "2026-07-16T12:00:00.000Z",
			metric: "weight",
			value: 82.5,
		});

		expect(metric.id).toBe("row-1");
		expect(inserts[0]).toMatchObject({
			table: "health_metrics",
			row: { metric: "weight", value: 82.5 },
		});
	});
});

describe("deleteMetric", () => {
	it("hard-deletes the row", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteMetric(sb, "metric-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("createMedication", () => {
	it("stores medication details on the medications table", async () => {
		const { sb, inserts } = stubSupabase();

		await createMedication(sb, { name: "Vitamin D", kind: "vitamin" });

		expect(inserts[0]).toMatchObject({ table: "medications", row: { name: "Vitamin D" } });
	});
});

describe("setMedicationActive", () => {
	it("patches only the active flag", async () => {
		const { sb, updates } = stubSupabase();

		await setMedicationActive(sb, "med-1", false);

		expect(updates[0]).toMatchObject({ table: "medications", patch: { active: false } });
	});
});

describe("createVisit", () => {
	it("stores visit details on the health_visits table", async () => {
		const { sb, inserts } = stubSupabase();

		await createVisit(sb, { visit_date: "2026-07-16", provider_name: "Dr. Souza" });

		expect(inserts[0]).toMatchObject({
			table: "health_visits",
			row: { visit_date: "2026-07-16" },
		});
	});
});

describe("addLabResult", () => {
	it("links the result to the given panel", async () => {
		const { sb, inserts } = stubSupabase();

		await addLabResult(sb, "panel-1", { analyte: "glucose", value: 90, flag: "high" });

		expect(inserts[0]).toMatchObject({
			table: "lab_results",
			row: { panel_id: "panel-1", analyte: "glucose", value: 90, flag: "high" },
		});
	});
});

describe("deleteLabPanel", () => {
	it("hard-deletes the panel (results cascade via FK)", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteLabPanel(sb, "panel-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("createWellbeingCheckIn", () => {
	it("stores mood/energy/sleep/pain on the wellbeing_check_ins table", async () => {
		const { sb, inserts } = stubSupabase();

		await createWellbeingCheckIn(sb, { mood: 4, energy: 3, sleep_quality: 5, pain: 1 });

		expect(inserts[0]).toMatchObject({
			table: "wellbeing_check_ins",
			row: { mood: 4, energy: 3, sleep_quality: 5, pain: 1 },
		});
	});
});

describe("createWorkout", () => {
	it("defaults source to manual", async () => {
		const { sb, inserts } = stubSupabase();

		await createWorkout(sb, { started_at: "2026-07-16T12:00:00.000Z", activity_type: "run" });

		expect(inserts[0]).toMatchObject({
			table: "workouts",
			row: { started_at: "2026-07-16T12:00:00.000Z", activity_type: "run", source: "manual" },
		});
	});
});

describe("deleteWorkout", () => {
	it("hard-deletes the row", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteWorkout(sb, "workout-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("createLabPanel + listLabPanels", () => {
	// Dedicated stub: supports the select/order/in chains these two functions
	// need on top of insert/select/single.
	function stubLabsSupabase() {
		const panelInserts: Array<Record<string, unknown>> = [];
		const resultInserts: Array<Record<string, unknown>[]> = [];

		const sb = {
			from: vi.fn((table: string) => {
				if (table === "lab_panels") {
					return {
						insert: vi.fn((row: Record<string, unknown>) => {
							panelInserts.push(row);
							return {
								select: vi.fn(() => ({
									single: vi.fn(async () => ({
										data: { id: "panel-1", ...row },
										error: null,
									})),
								})),
							};
						}),
						select: vi.fn(() => ({
							order: vi.fn(async () => ({
								data: [
									{
										id: "panel-1",
										drawn_date: "2026-07-16",
										panel_name: "Basic metabolic panel",
										ordering_provider: null,
										lab_facility: null,
										notes: null,
										visit_id: null,
										created_at: "2026-07-16T00:00:00.000Z",
										updated_at: "2026-07-16T00:00:00.000Z",
									},
								],
								error: null,
							})),
						})),
					};
				}
				if (table === "lab_results") {
					return {
						insert: vi.fn((rows: Record<string, unknown>[]) => {
							resultInserts.push(rows);
							return {
								select: vi.fn(async () => ({
									data: rows.map((r, i) => ({ id: `result-${i + 1}`, ...r })),
									error: null,
								})),
							};
						}),
						select: vi.fn(() => ({
							in: vi.fn(async () => ({
								data: [{ id: "result-1", panel_id: "panel-1", analyte: "glucose", value: 90 }],
								error: null,
							})),
						})),
					};
				}
				throw new Error(`unexpected table: ${table}`);
			}),
		} as unknown as SupabaseClient;

		return { sb, panelInserts, resultInserts };
	}

	it("createLabPanel seeds initial results in one round-trip", async () => {
		const { sb, panelInserts, resultInserts } = stubLabsSupabase();

		const panel = await createLabPanel(sb, {
			drawn_date: "2026-07-16",
			panel_name: "Basic metabolic panel",
			results: [{ analyte: "glucose", value: 90 }],
		});

		expect(panelInserts[0]).toMatchObject({ panel_name: "Basic metabolic panel" });
		expect(resultInserts[0]).toMatchObject([
			{ analyte: "glucose", value: 90, panel_id: "panel-1" },
		]);
		expect(panel.results).toHaveLength(1);
	});

	it("listLabPanels returns panels newest-drawn-first with results attached", async () => {
		const { sb } = stubLabsSupabase();

		const panels = await listLabPanels(sb);

		expect(panels).toHaveLength(1);
		expect(panels[0].panel_name).toBe("Basic metabolic panel");
		expect(panels[0].results).toMatchObject([{ analyte: "glucose", value: 90 }]);
	});
});
