import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
	HealthMetricSourceSchema,
	MedicationKindSchema,
	VisitTypeSchema,
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
