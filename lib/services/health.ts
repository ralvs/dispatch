import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
	HealthMetricSourceSchema,
	LabResultFlagSchema,
	MedicationKindSchema,
	VisitTypeSchema,
	WorkoutSourceSchema,
} from "@/lib/schemas/health";
import { unwrap } from "@/lib/services/errors";

// ─── Metrics ────────────────────────────────────────────────────────────

const METRIC_SELECT =
	"id, measured_at, metric, value, value_secondary, unit, source, visit_id, notes, created_at, updated_at";

export type HealthMetricRow = {
	id: string;
	measured_at: string;
	metric: string;
	value: number | null;
	value_secondary: number | null;
	unit: string | null;
	source: z.infer<typeof HealthMetricSourceSchema>;
	visit_id: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateHealthMetricInput = {
	measured_at: string;
	metric: string;
	value?: number | null;
	value_secondary?: number | null;
	unit?: string | null;
	source?: z.infer<typeof HealthMetricSourceSchema>;
	visit_id?: string | null;
	notes?: string | null;
};

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
	return (data ?? []) as HealthMetricRow[];
}

export async function createMetric(
	sb: SupabaseClient,
	input: CreateHealthMetricInput,
): Promise<HealthMetricRow> {
	const data = unwrap(await sb.from("health_metrics").insert(input).select(METRIC_SELECT).single());
	return data as HealthMetricRow;
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

const MEDICATION_SELECT =
	"id, name, kind, dosage, frequency, prescribing_provider, reason, start_date, stop_date, active, notes, created_at, updated_at";

export type MedicationRow = {
	id: string;
	name: string;
	kind: z.infer<typeof MedicationKindSchema>;
	dosage: string | null;
	frequency: string | null;
	prescribing_provider: string | null;
	reason: string | null;
	start_date: string | null;
	stop_date: string | null;
	active: boolean;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateMedicationInput = {
	name: string;
	kind?: z.infer<typeof MedicationKindSchema>;
	dosage?: string | null;
	frequency?: string | null;
	prescribing_provider?: string | null;
	reason?: string | null;
	start_date?: string | null;
	stop_date?: string | null;
	active?: boolean;
	notes?: string | null;
};

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
	return (data ?? []) as MedicationRow[];
}

export async function createMedication(
	sb: SupabaseClient,
	input: CreateMedicationInput,
): Promise<MedicationRow> {
	const data = unwrap(
		await sb.from("medications").insert(input).select(MEDICATION_SELECT).single(),
	);
	return data as MedicationRow;
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

const VISIT_SELECT =
	"id, visit_date, provider_name, provider_specialty, visit_type, reason, assessment, plan, notes, follow_up_date, created_at, updated_at";

export type HealthVisitRow = {
	id: string;
	visit_date: string;
	provider_name: string | null;
	provider_specialty: string | null;
	visit_type: z.infer<typeof VisitTypeSchema> | null;
	reason: string | null;
	assessment: string | null;
	plan: string | null;
	notes: string | null;
	follow_up_date: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateHealthVisitInput = {
	visit_date: string;
	provider_name?: string | null;
	provider_specialty?: string | null;
	visit_type?: z.infer<typeof VisitTypeSchema> | null;
	reason?: string | null;
	assessment?: string | null;
	plan?: string | null;
	notes?: string | null;
	follow_up_date?: string | null;
};

export async function listVisits(sb: SupabaseClient): Promise<HealthVisitRow[]> {
	const data = unwrap(
		await sb.from("health_visits").select(VISIT_SELECT).order("visit_date", { ascending: false }),
	);
	return (data ?? []) as HealthVisitRow[];
}

export async function createVisit(
	sb: SupabaseClient,
	input: CreateHealthVisitInput,
): Promise<HealthVisitRow> {
	const data = unwrap(await sb.from("health_visits").insert(input).select(VISIT_SELECT).single());
	return data as HealthVisitRow;
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

const LAB_RESULT_SELECT =
	"id, panel_id, analyte, value, value_text, unit, reference_range_low, reference_range_high, reference_text, flag, notes, created_at";

export type LabResultRow = {
	id: string;
	panel_id: string;
	analyte: string;
	value: number | null;
	value_text: string | null;
	unit: string | null;
	reference_range_low: number | null;
	reference_range_high: number | null;
	reference_text: string | null;
	flag: z.infer<typeof LabResultFlagSchema> | null;
	notes: string | null;
	created_at: string;
};

export type CreateLabResultInput = {
	analyte: string;
	value?: number | null;
	value_text?: string | null;
	unit?: string | null;
	reference_range_low?: number | null;
	reference_range_high?: number | null;
	reference_text?: string | null;
	flag?: z.infer<typeof LabResultFlagSchema> | null;
	notes?: string | null;
};

const LAB_PANEL_SELECT =
	"id, drawn_date, panel_name, ordering_provider, lab_facility, notes, visit_id, created_at, updated_at";

export type LabPanelRow = {
	id: string;
	drawn_date: string;
	panel_name: string;
	ordering_provider: string | null;
	lab_facility: string | null;
	notes: string | null;
	visit_id: string | null;
	created_at: string;
	updated_at: string;
};

export type LabPanelWithResults = LabPanelRow & { results: LabResultRow[] };

export type CreateLabPanelInput = {
	drawn_date: string;
	panel_name: string;
	ordering_provider?: string | null;
	lab_facility?: string | null;
	notes?: string | null;
	visit_id?: string | null;
	results?: CreateLabResultInput[];
};

/** Panels newest-drawn-first, each with its results attached. */
export async function listLabPanels(sb: SupabaseClient): Promise<LabPanelWithResults[]> {
	const panels = unwrap(
		await sb.from("lab_panels").select(LAB_PANEL_SELECT).order("drawn_date", { ascending: false }),
	) as LabPanelRow[];
	if (!panels || panels.length === 0) return [];

	const results = unwrap(
		await sb
			.from("lab_results")
			.select(LAB_RESULT_SELECT)
			.in(
				"panel_id",
				panels.map((p) => p.id),
			),
	) as LabResultRow[];

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
	) as LabPanelRow;

	if (!results || results.length === 0) return { ...panel, results: [] };

	const inserted = unwrap(
		await sb
			.from("lab_results")
			.insert(results.map((r) => ({ ...r, panel_id: panel.id })))
			.select(LAB_RESULT_SELECT),
	) as LabResultRow[];

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
	return data as LabResultRow;
}

export async function deleteLabResult(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("lab_results").delete().eq("id", id));
}

// ─── Wellbeing check-ins ─────────────────────────────────────────────────

const WELLBEING_SELECT = "id, checked_in_at, mood, energy, sleep_quality, pain, notes, created_at";

export type WellbeingCheckInRow = {
	id: string;
	checked_in_at: string;
	mood: number | null;
	energy: number | null;
	sleep_quality: number | null;
	pain: number | null;
	notes: string | null;
	created_at: string;
};

export type CreateWellbeingCheckInInput = {
	checked_in_at?: string;
	mood?: number | null;
	energy?: number | null;
	sleep_quality?: number | null;
	pain?: number | null;
	notes?: string | null;
};

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
	return (data ?? []) as WellbeingCheckInRow[];
}

export async function createWellbeingCheckIn(
	sb: SupabaseClient,
	input: CreateWellbeingCheckInInput,
): Promise<WellbeingCheckInRow> {
	const data = unwrap(
		await sb.from("wellbeing_check_ins").insert(input).select(WELLBEING_SELECT).single(),
	);
	return data as WellbeingCheckInRow;
}

export async function deleteWellbeingCheckIn(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("wellbeing_check_ins").delete().eq("id", id));
}

// ─── Workouts ────────────────────────────────────────────────────────────

const WORKOUT_SELECT =
	"id, started_at, ended_at, duration_min, activity_type, distance_m, avg_hr, max_hr, calories, elevation_gain_m, pace_sec_per_km, power_avg_watts, source, notes, created_at";

export type WorkoutRow = {
	id: string;
	started_at: string;
	ended_at: string | null;
	duration_min: number | null;
	activity_type: string | null;
	distance_m: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	calories: number | null;
	elevation_gain_m: number | null;
	pace_sec_per_km: number | null;
	power_avg_watts: number | null;
	source: z.infer<typeof WorkoutSourceSchema>;
	notes: string | null;
	created_at: string;
};

export type CreateWorkoutInput = {
	started_at: string;
	duration_min?: number | null;
	activity_type?: string | null;
	distance_m?: number | null;
	notes?: string | null;
	source?: z.infer<typeof WorkoutSourceSchema>;
};

export async function listWorkouts(
	sb: SupabaseClient,
	filters: { limit?: number } = {},
): Promise<WorkoutRow[]> {
	let q = sb.from("workouts").select(WORKOUT_SELECT).order("started_at", { ascending: false });
	if (filters.limit) q = q.limit(filters.limit);
	const data = unwrap(await q);
	return (data ?? []) as WorkoutRow[];
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
	return data as WorkoutRow;
}

export async function deleteWorkout(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("workouts").delete().eq("id", id));
}
