"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { instantFromLocal, nowUtc } from "@/lib/dates";
import { decodeForm } from "@/lib/form-decode";
import {
	CreateHealthMetricSchema,
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

export async function createMetricAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateHealthMetricSchema, formData, {
		spec: { value: "number", value_secondary: "number" },
		overrides: { measured_at: nowUtc() },
	});
	await createMetric(sb, parsed);
	revalidateHealthViews();
}

export async function deleteMetricAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteMetric(sb, z.uuid().parse(id));
	revalidateHealthViews();
}

export async function createMedicationAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateMedicationSchema, formData);
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
	const parsed = decodeForm(CreateHealthVisitSchema, formData);
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
	const parsed = decodeForm(CreateLabPanelSchema, formData);
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
	const parsed = decodeForm(CreateLabResultSchema, formData, {
		spec: { value: "number", reference_range_low: "number", reference_range_high: "number" },
	});
	await addLabResult(sb, z.uuid().parse(panelId), parsed);
	revalidateHealthViews();
}

export async function createWellbeingCheckInAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateWellbeingCheckInSchema, formData, {
		spec: { mood: "number", energy: "number", sleep_quality: "number", pain: "number" },
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
	const parsed = decodeForm(CreateWorkoutSchema, formData, {
		spec: { duration_min: "number", distance_m: "number" },
		overrides: { started_at: startedAtUtc },
	});
	await createWorkout(sb, parsed);
	revalidateHealthViews();
}

export async function deleteWorkoutAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteWorkout(sb, z.uuid().parse(id));
	revalidateHealthViews();
}
