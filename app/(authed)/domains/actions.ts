"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateDomainSchema, UpdateDomainSchema } from "@/lib/schemas/domain";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	reactivateDomain,
	setDomainCadence,
	updateDomain,
} from "@/lib/services/domains";

function revalidateDomainViews() {
	afterMutation("settings.domain");
}

export async function createDomainAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateDomainSchema, formData);
	await createDomain(sb, parsed);
	revalidateDomainViews();
}

// Blank clears the rule, which stops the observations cron flagging the domain.
const CadenceDaysSchema = z
	.string()
	.trim()
	.transform((raw) => (raw === "" ? null : Number(raw)))
	.refine((n) => n === null || (Number.isInteger(n) && n > 0 && n <= 365), {
		message: "Cadence must be a whole number of days between 1 and 365",
	});

export async function updateDomainAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateDomainSchema, formData);
	await updateDomain(sb, domainId, parsed);
	// The cadence rule rides in the same form but not the same patch: it lives
	// inside failure_patterns and needs a read-merge-write to leave the rules
	// this editor does not manage alone.
	if (formData.has("cadence_days")) {
		const days = CadenceDaysSchema.parse(String(formData.get("cadence_days")));
		await setDomainCadence(sb, domainId, days);
	}
	revalidateDomainViews();
}

export async function archiveDomainAction(id: string) {
	const { sb } = await requireOwnerPage();
	await archiveDomain(sb, z.uuid().parse(id));
	revalidateDomainViews();
}

export async function reactivateDomainAction(id: string) {
	const { sb } = await requireOwnerPage();
	await reactivateDomain(sb, z.uuid().parse(id));
	revalidateDomainViews();
}

export async function markDomainShippedAction(id: string) {
	const { sb } = await requireOwnerPage();
	await markDomainShipped(sb, z.uuid().parse(id));
	revalidateDomainViews();
}
