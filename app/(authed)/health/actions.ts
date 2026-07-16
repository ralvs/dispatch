"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { instantFromLocal, nowUtc } from "@/lib/dates";
import {
	CreateHealthVisitSchema,
	CreateLabPanelSchema,
	CreateLabResultSchema,
	CreateMedicationSchema,
	CreateWellbeingCheckInSchema,
	CreateWorkoutSchema,
} from "@/lib/schemas/health";
import {
	addLabResult,
	createLabPanel,
	createMedication,
	createMetric,
	createVisit,
	createWellbeingCheckIn,
	createWorkout,
	deleteLabPanel,
	deleteMedication,
	deleteMetric,
	deleteVisit,
	deleteWorkout,
	setMedicationActive,
} from "@/lib/services/health";
import { getAppTimezone } from "@/lib/services/settings";

function revalidateHealthViews() {
	revalidatePath("/health");
}

function numberOrNull(raw: FormDataEntryValue | null): number | null {
	if (typeof raw !== "string" || raw.trim() === "") return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

function stringOrNull(raw: FormDataEntryValue | null): string | null {
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	return trimmed === "" ? null : trimmed;
}

export async function createMetricAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const metric = formData.get("metric");
	if (typeof metric !== "string" || metric.trim() === "") throw new Error("metric is required");
	await createMetric(sb, {
		measured_at: nowUtc(),
		metric: metric.trim(),
		value: numberOrNull(formData.get("value")),
		value_secondary: numberOrNull(formData.get("value_secondary")),
		unit: stringOrNull(formData.get("unit")),
		notes: stringOrNull(formData.get("notes")),
	});
	revalidateHealthViews();
}

export async function deleteMetricAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteMetric(sb, z.uuid().parse(id));
	revalidateHealthViews();
}

export async function createMedicationAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateMedicationSchema.parse({
		name: formData.get("name"),
		kind: formData.get("kind") || undefined,
		dosage: stringOrNull(formData.get("dosage")),
		frequency: stringOrNull(formData.get("frequency")),
	});
	await createMedication(sb, parsed);
	revalidateHealthViews();
}

export async function setMedicationActiveAction(id: string, active: boolean) {
	const { sb } = await requireOwnerPage();
	await setMedicationActive(sb, z.uuid().parse(id), active);
	revalidateHealthViews();
}

export async function deleteMedicationAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteMedication(sb, z.uuid().parse(id));
	revalidateHealthViews();
}

export async function createVisitAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateHealthVisitSchema.parse({
		visit_date: formData.get("visit_date"),
		provider_name: stringOrNull(formData.get("provider_name")),
		provider_specialty: stringOrNull(formData.get("provider_specialty")),
		visit_type: formData.get("visit_type") || null,
		reason: stringOrNull(formData.get("reason")),
	});
	await createVisit(sb, parsed);
	revalidateHealthViews();
}

export async function deleteVisitAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteVisit(sb, z.uuid().parse(id));
	revalidateHealthViews();
}

export async function createLabPanelAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateLabPanelSchema.parse({
		drawn_date: formData.get("drawn_date"),
		panel_name: formData.get("panel_name"),
		ordering_provider: stringOrNull(formData.get("ordering_provider")),
		lab_facility: stringOrNull(formData.get("lab_facility")),
	});
	await createLabPanel(sb, parsed);
	revalidateHealthViews();
}

export async function deleteLabPanelAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteLabPanel(sb, z.uuid().parse(id));
	revalidateHealthViews();
}

export async function addLabResultAction(panelId: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateLabResultSchema.parse({
		analyte: formData.get("analyte"),
		value: numberOrNull(formData.get("value")),
		unit: stringOrNull(formData.get("unit")),
		reference_range_low: numberOrNull(formData.get("reference_range_low")),
		reference_range_high: numberOrNull(formData.get("reference_range_high")),
		flag: formData.get("flag") || null,
	});
	await addLabResult(sb, z.uuid().parse(panelId), parsed);
	revalidateHealthViews();
}

export async function createWellbeingCheckInAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateWellbeingCheckInSchema.parse({
		mood: numberOrNull(formData.get("mood")),
		energy: numberOrNull(formData.get("energy")),
		sleep_quality: numberOrNull(formData.get("sleep_quality")),
		pain: numberOrNull(formData.get("pain")),
		notes: stringOrNull(formData.get("notes")),
	});
	await createWellbeingCheckIn(sb, parsed);
	revalidateHealthViews();
}

export async function createWorkoutAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const startedAtLocal = formData.get("started_at");
	let startedAtUtc = nowUtc();
	if (typeof startedAtLocal === "string" && startedAtLocal) {
		const [datePart, timePart] = startedAtLocal.split("T");
		if (datePart && timePart) {
			const tz = await getAppTimezone(sb);
			startedAtUtc = instantFromLocal(datePart, timePart, tz);
		}
	}
	const parsed = CreateWorkoutSchema.parse({
		started_at: startedAtUtc,
		duration_min: numberOrNull(formData.get("duration_min")),
		activity_type: stringOrNull(formData.get("activity_type")),
		distance_m: numberOrNull(formData.get("distance_m")),
		notes: stringOrNull(formData.get("notes")),
	});
	await createWorkout(sb, parsed);
	revalidateHealthViews();
}

export async function deleteWorkoutAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteWorkout(sb, z.uuid().parse(id));
	revalidateHealthViews();
}
