"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { CreateDomainSchema, UpdateDomainSchema } from "@/lib/schemas/domain";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	reactivateDomain,
	updateDomain,
} from "@/lib/services/domains";

function revalidateDomainViews() {
	revalidatePath("/domains");
}

export async function createDomainAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateDomainSchema.parse({
		name: formData.get("name"),
		description: formData.get("description") || null,
		fruit_definition: formData.get("fruit_definition") || null,
		expected_cadence: formData.get("expected_cadence") || null,
	});
	await createDomain(sb, parsed);
	revalidateDomainViews();
}

export async function updateDomainAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	const parsed = UpdateDomainSchema.parse({
		name: formData.get("name") || undefined,
		description: formData.get("description") || null,
		fruit_definition: formData.get("fruit_definition") || null,
		expected_cadence: formData.get("expected_cadence") || null,
	});
	await updateDomain(sb, domainId, parsed);
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
