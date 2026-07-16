import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	createMedication,
	createMetric,
	createVisit,
	deleteMetric,
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
