import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
	type CreateHealthMetricSchema,
	type CreateHealthVisitSchema,
	type CreateLabPanelSchema,
	type CreateLabResultSchema,
	type CreateMedicationSchema,
	type CreateWellbeingCheckInSchema,
	type CreateWorkoutSchema,
	type HealthMetricRow,
	type HealthVisitRow,
	LAB_PANEL_SELECT,
	LAB_RESULT_SELECT,
	type LabPanelRow,
	type LabPanelWithResults,
	type LabResultRow,
	MEDICATION_SELECT,
	METRIC_SELECT,
	type MedicationRow,
	VISIT_SELECT,
	WELLBEING_SELECT,
	type WellbeingCheckInRow,
	WORKOUT_SELECT,
	type WorkoutRow,
	type WorkoutSourceSchema,
} from "@/lib/schemas/health";
import { unwrap } from "@/lib/services/errors";

// ─── Metrics ────────────────────────────────────────────────────────────

export type { HealthMetricRow };

export type CreateHealthMetricInput = z.infer<typeof CreateHealthMetricSchema>;

export async function listMetrics(
	sb: SupabaseClient,
	filters: { metric?: string; limit?: number } = {},
): Promise<HealthMetricRow[]> {
	let q = sb.from("health_metrics").select(METRIC_SELECT).order("measured_at", {
		ascending: false,
	});
	if (filters.metric) q = q.eq("metric", filters.metric);
	if (filters.limit) q = q.limit(filters.limit);
	const data = unwrap(await q);
	return (data ?? []) as unknown as HealthMetricRow[];
}

export async function createMetric(
	sb: SupabaseClient,
	input: CreateHealthMetricInput,
): Promise<HealthMetricRow> {
	const data = unwrap(await sb.from("health_metrics").insert(input).select(METRIC_SELECT).single());
	return data as unknown as HealthMetricRow;
}

export async function updateMetric(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreateHealthMetricInput>,
): Promise<void> {
	unwrap(await sb.from("health_metrics").update(patch).eq("id", id));
}

export async function deleteMetric(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("health_metrics").delete().eq("id", id));
}

// ─── Medications ────────────────────────────────────────────────────────

export type { MedicationRow };

export type CreateMedicationInput = z.infer<typeof CreateMedicationSchema>;

export async function listMedications(
	sb: SupabaseClient,
	filters: { includeInactive?: boolean } = {},
): Promise<MedicationRow[]> {
	let q = sb
		.from("medications")
		.select(MEDICATION_SELECT)
		.order("active", { ascending: false })
		.order("name", { ascending: true });
	if (!filters.includeInactive) q = q.eq("active", true);
	const data = unwrap(await q);
	return (data ?? []) as unknown as MedicationRow[];
}

export async function createMedication(
	sb: SupabaseClient,
	input: CreateMedicationInput,
): Promise<MedicationRow> {
	const data = unwrap(
		await sb.from("medications").insert(input).select(MEDICATION_SELECT).single(),
	);
	return data as unknown as MedicationRow;
}

export async function updateMedication(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreateMedicationInput>,
): Promise<void> {
	unwrap(await sb.from("medications").update(patch).eq("id", id));
}

export async function deleteMedication(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("medications").delete().eq("id", id));
}

export async function setMedicationActive(
	sb: SupabaseClient,
	id: string,
	active: boolean,
): Promise<void> {
	unwrap(await sb.from("medications").update({ active }).eq("id", id));
}

// ─── Visits ─────────────────────────────────────────────────────────────

export type { HealthVisitRow };

export type CreateHealthVisitInput = z.infer<typeof CreateHealthVisitSchema>;

export async function listVisits(sb: SupabaseClient): Promise<HealthVisitRow[]> {
	const data = unwrap(
		await sb.from("health_visits").select(VISIT_SELECT).order("visit_date", { ascending: false }),
	);
	return (data ?? []) as unknown as HealthVisitRow[];
}

export async function createVisit(
	sb: SupabaseClient,
	input: CreateHealthVisitInput,
): Promise<HealthVisitRow> {
	const data = unwrap(await sb.from("health_visits").insert(input).select(VISIT_SELECT).single());
	return data as unknown as HealthVisitRow;
}

export async function updateVisit(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreateHealthVisitInput>,
): Promise<void> {
	unwrap(await sb.from("health_visits").update(patch).eq("id", id));
}

export async function deleteVisit(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("health_visits").delete().eq("id", id));
}

// ─── Lab panels + results ────────────────────────────────────────────────

export type { LabPanelRow, LabPanelWithResults, LabResultRow };

export type CreateLabResultInput = z.infer<typeof CreateLabResultSchema>;
export type CreateLabPanelInput = z.infer<typeof CreateLabPanelSchema>;

/** Panels newest-drawn-first, each with its results attached. */
export async function listLabPanels(sb: SupabaseClient): Promise<LabPanelWithResults[]> {
	const panels = unwrap(
		await sb.from("lab_panels").select(LAB_PANEL_SELECT).order("drawn_date", { ascending: false }),
	) as unknown as LabPanelRow[];
	if (!panels || panels.length === 0) return [];

	const results = unwrap(
		await sb
			.from("lab_results")
			.select(LAB_RESULT_SELECT)
			.in(
				"panel_id",
				panels.map((p) => p.id),
			),
	) as unknown as LabResultRow[];

	return panels.map((panel) => ({
		...panel,
		results: (results ?? []).filter((r) => r.panel_id === panel.id),
	}));
}

/** Create a panel, optionally seeding its initial results in one round-trip. */
export async function createLabPanel(
	sb: SupabaseClient,
	input: CreateLabPanelInput,
): Promise<LabPanelWithResults> {
	const { results, ...panelInput } = input;
	const panel = unwrap(
		await sb.from("lab_panels").insert(panelInput).select(LAB_PANEL_SELECT).single(),
	) as unknown as LabPanelRow;

	if (!results || results.length === 0) return { ...panel, results: [] };

	const inserted = unwrap(
		await sb
			.from("lab_results")
			.insert(results.map((r) => ({ ...r, panel_id: panel.id })))
			.select(LAB_RESULT_SELECT),
	) as unknown as LabResultRow[];

	return { ...panel, results: inserted ?? [] };
}

export async function deleteLabPanel(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("lab_panels").delete().eq("id", id));
}

/** Add a single result to an existing panel. */
export async function addLabResult(
	sb: SupabaseClient,
	panelId: string,
	input: CreateLabResultInput,
): Promise<LabResultRow> {
	const data = unwrap(
		await sb
			.from("lab_results")
			.insert({ ...input, panel_id: panelId })
			.select(LAB_RESULT_SELECT)
			.single(),
	);
	return data as unknown as LabResultRow;
}

export async function deleteLabResult(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("lab_results").delete().eq("id", id));
}

// ─── Wellbeing check-ins ─────────────────────────────────────────────────

export type { WellbeingCheckInRow };

export type CreateWellbeingCheckInInput = z.infer<typeof CreateWellbeingCheckInSchema>;

export async function listWellbeingCheckIns(
	sb: SupabaseClient,
	filters: { limit?: number } = {},
): Promise<WellbeingCheckInRow[]> {
	let q = sb
		.from("wellbeing_check_ins")
		.select(WELLBEING_SELECT)
		.order("checked_in_at", { ascending: false });
	if (filters.limit) q = q.limit(filters.limit);
	const data = unwrap(await q);
	return (data ?? []) as unknown as WellbeingCheckInRow[];
}

export async function createWellbeingCheckIn(
	sb: SupabaseClient,
	input: CreateWellbeingCheckInInput,
): Promise<WellbeingCheckInRow> {
	const data = unwrap(
		await sb.from("wellbeing_check_ins").insert(input).select(WELLBEING_SELECT).single(),
	);
	return data as unknown as WellbeingCheckInRow;
}

export async function deleteWellbeingCheckIn(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("wellbeing_check_ins").delete().eq("id", id));
}

// ─── Workouts ────────────────────────────────────────────────────────────

export type { WorkoutRow };

// shape intentionally differs from CreateWorkoutSchema: the zod schema
// deliberately omits `source` (device-import fields are populated by a
// future import path, not the manual-entry form per its own comment in
// lib/schemas/health.ts) — but createWorkout below still accepts an
// optional `source` override and defaults it to "manual". Keeping the
// hand-written type so that field stays typed here.
export type CreateWorkoutInput = z.infer<typeof CreateWorkoutSchema> & {
	source?: z.infer<typeof WorkoutSourceSchema>;
};

export async function listWorkouts(
	sb: SupabaseClient,
	filters: { limit?: number } = {},
): Promise<WorkoutRow[]> {
	let q = sb.from("workouts").select(WORKOUT_SELECT).order("started_at", { ascending: false });
	if (filters.limit) q = q.limit(filters.limit);
	const data = unwrap(await q);
	return (data ?? []) as unknown as WorkoutRow[];
}

/** Manual workout entry. Device-import fields (avg_hr, calories, etc.) stay
 * null until a future import path populates them. */
export async function createWorkout(
	sb: SupabaseClient,
	input: CreateWorkoutInput,
): Promise<WorkoutRow> {
	const data = unwrap(
		await sb
			.from("workouts")
			.insert({ ...input, source: input.source ?? "manual" })
			.select(WORKOUT_SELECT)
			.single(),
	);
	return data as unknown as WorkoutRow;
}

export async function deleteWorkout(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("workouts").delete().eq("id", id));
}
