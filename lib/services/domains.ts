import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import type { CreateDomainSchema } from "@/lib/schemas/domain";
import { DOMAIN_SELECT, type DomainRow, type UpdateDomainSchema } from "@/lib/schemas/domain";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─── Stewardship domains ───────────────────────────────────────────────
// docs/adr/0007: domains gain full CRUD here (the reference implementation
// was seed-only). The system Inbox domain (`is_system=true`) is a fixed
// catch-all — never renamable, never archivable. That's enforced here, not
// just hidden in the UI, so a stray direct call can't slip past it.

export type { DomainRow };

export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;
export type UpdateDomainInput = z.infer<typeof UpdateDomainSchema>;

export async function listDomains(
	sb: SupabaseClient,
	filters: { includeArchived?: boolean } = {},
): Promise<DomainRow[]> {
	let q = sb
		.from("stewardship_domains")
		.select(DOMAIN_SELECT)
		.order("active", { ascending: false })
		.order("name", { ascending: true });
	if (!filters.includeArchived) q = q.eq("active", true);
	const data = unwrap(await q);
	return (data ?? []) as unknown as DomainRow[];
}

export async function getDomain(sb: SupabaseClient, id: string): Promise<DomainRow | null> {
	const data = unwrap(
		await sb.from("stewardship_domains").select(DOMAIN_SELECT).eq("id", id).maybeSingle(),
	);
	return (data as DomainRow | null) ?? null;
}

export async function createDomain(
	sb: SupabaseClient,
	input: CreateDomainInput,
): Promise<DomainRow> {
	const data = unwrap(
		await sb.from("stewardship_domains").insert(input).select(DOMAIN_SELECT).single(),
	);
	return data as unknown as DomainRow;
}

async function assertNotSystem(sb: SupabaseClient, id: string, action: string): Promise<void> {
	const domain = await getDomain(sb, id);
	if (!domain) throw new ServiceError(`Domain ${id} not found`, "NOT_FOUND");
	if (domain.is_system) {
		throw new ServiceError(`The system Inbox domain cannot be ${action}`, "FORBIDDEN");
	}
}

export async function updateDomain(
	sb: SupabaseClient,
	id: string,
	patch: UpdateDomainInput,
): Promise<void> {
	await assertNotSystem(sb, id, "edited");
	unwrap(await sb.from("stewardship_domains").update(patch).eq("id", id));
}

/** Soft-removes the domain from active views without deleting it. */
export async function archiveDomain(sb: SupabaseClient, id: string): Promise<void> {
	await assertNotSystem(sb, id, "archived");
	unwrap(await sb.from("stewardship_domains").update({ active: false }).eq("id", id));
}

export async function reactivateDomain(sb: SupabaseClient, id: string): Promise<void> {
	await assertNotSystem(sb, id, "reactivated");
	unwrap(await sb.from("stewardship_domains").update({ active: true }).eq("id", id));
}

/** Stamps last_shipped_at = now(). ADR 0007's manual "I shipped something" marker. */
export async function markDomainShipped(sb: SupabaseClient, id: string): Promise<void> {
	await assertNotSystem(sb, id, "marked shipped");
	unwrap(await sb.from("stewardship_domains").update({ last_shipped_at: nowUtc() }).eq("id", id));
}
