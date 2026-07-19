"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { CreateDomainSchema, UpdateDomainSchema } from "@/lib/schemas/domain";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	reactivateDomain,
	updateDomain,
} from "@/lib/services/domains";

function revalidateDomainViews() {
	revalidatePath("/settings");
}

export async function createDomainAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateDomainSchema, formData);
	await createDomain(sb, parsed);
	revalidateDomainViews();
}

export async function updateDomainAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const domainId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateDomainSchema, formData);
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
