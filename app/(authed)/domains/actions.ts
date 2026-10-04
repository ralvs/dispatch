"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/invalidate";
import { CreateDomainSchema, type DomainItem, UpdateDomainSchema } from "@/lib/schemas/domain";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	reactivateDomain,
	setDomainCadence,
	updateDomain,
} from "@/lib/services/domains";
import { written } from "@/lib/services/written";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the domain it wrote as /domains shows it — with its
// cadence rule and last touch (#30) — so the entity store confirms from it and
// the stat band moves without a page render. Failures that are not a form's
// field errors throw; the store runner rolls back on a throw.

type DomainWrite = StoreWrite<DomainItem>;

function revalidateDomainViews() {
	afterMutation("settings.domain");
}

export async function createDomainAction(formData: FormData): Promise<ActionResult<DomainWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const domain = await createDomain(sb, decodeForm(CreateDomainSchema, formData));
		revalidateDomainViews();
		return written(sb, "domain", domain.id);
	});
}

// Blank clears the rule, which stops the observations cron flagging the domain.
const CadenceDaysSchema = z
	.string()
	.trim()
	.transform((raw) => (raw === "" ? null : Number(raw)))
	.refine((n) => n === null || (Number.isInteger(n) && n > 0 && n <= 365), {
		message: "Cadence must be a whole number of days between 1 and 365",
	});

export async function updateDomainAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<DomainWrite>> {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateDomainSchema, formData);
	// Parsed before any write, so a bad cadence changes nothing.
	const days = formData.has("cadence_days")
		? CadenceDaysSchema.parse(String(formData.get("cadence_days")))
		: undefined;
	await updateDomain(sb, domainId, parsed);
	// The cadence rule rides in the same form but not the same patch: it lives
	// inside failure_patterns and needs a read-merge-write to leave the rules
	// this editor does not manage alone.
	if (days !== undefined) await setDomainCadence(sb, domainId, days);
	revalidateDomainViews();
	return { ok: true, data: await written(sb, "domain", domainId) };
}

export async function archiveDomainAction(id: string): Promise<ActionResult<DomainWrite>> {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	await archiveDomain(sb, domainId);
	revalidateDomainViews();
	return { ok: true, data: await written(sb, "domain", domainId) };
}

export async function reactivateDomainAction(id: string): Promise<ActionResult<DomainWrite>> {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	await reactivateDomain(sb, domainId);
	revalidateDomainViews();
	return { ok: true, data: await written(sb, "domain", domainId) };
}

export async function markDomainShippedAction(id: string): Promise<ActionResult<DomainWrite>> {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	await markDomainShipped(sb, domainId);
	revalidateDomainViews();
	return { ok: true, data: await written(sb, "domain", domainId) };
}
