"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { nowUtc } from "@/lib/dates";
import { CreateHealthVisitSchema, CreateMedicationSchema } from "@/lib/schemas/health";
import {
	createMedication,
	createMetric,
	createVisit,
	deleteMedication,
	deleteMetric,
	deleteVisit,
	setMedicationActive,
} from "@/lib/services/health";

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
