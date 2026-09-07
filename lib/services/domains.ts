import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import type { CreateDomainSchema } from "@/lib/schemas/domain";
import { DOMAIN_SELECT, type DomainRow, type UpdateDomainSchema } from "@/lib/schemas/domain";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─── Stewardship domains ───────────────────────────────────────────────
// docs/adr/0007: domains gain full CRUD here (the reference implementation
// was seed-only). Every row is a real domain and every row is editable —
// the Inbox pseudo-domain that used to need protecting from rename and
// archive is gone, replaced by a null domain_id (docs/adr/0027).

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

export async function updateDomain(
	sb: SupabaseClient,
	id: string,
	patch: UpdateDomainInput,
): Promise<void> {
	unwrap(await sb.from("stewardship_domains").update(patch).eq("id", id));
}

/** Soft-removes the domain from active views without deleting it. */
export async function archiveDomain(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("stewardship_domains").update({ active: false }).eq("id", id));
}

export async function reactivateDomain(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("stewardship_domains").update({ active: true }).eq("id", id));
}

/** Stamps last_shipped_at = now(). ADR 0007's manual "I shipped something" marker. */
export async function markDomainShipped(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("stewardship_domains").update({ last_shipped_at: nowUtc() }).eq("id", id));
}

// ─── Cadence rule ───────────────────────────────────────────────────────
//
// The numeric threshold hiding in failure_patterns jsonb. Read and write
// live here so observations, /domains, and the editor cannot drift on the
// shape (seed: [{"rule":"no_activity_days","value":7}, …]).

const CADENCE_RULES = ["no_activity_days", "days_since_journal"] as const;

type CadenceRule = (typeof CADENCE_RULES)[number];
type FailurePattern = { rule: string; value?: unknown };

function isFailurePattern(entry: unknown): entry is FailurePattern {
	return (
		typeof entry === "object" &&
		entry !== null &&
		typeof (entry as FailurePattern).rule === "string"
	);
}

function isCadenceRule(rule: string): rule is CadenceRule {
	return (CADENCE_RULES as readonly string[]).includes(rule);
}

/**
 * The domain's "flag after N days" number, or null when it has no cadence
 * rule. Defensive: any malformed shape yields null.
 */
export function cadenceThresholdDays(failurePatterns: unknown): number | null {
	if (!Array.isArray(failurePatterns)) return null;
	for (const entry of failurePatterns) {
		if (!isFailurePattern(entry) || !isCadenceRule(entry.rule)) continue;
		if (typeof entry.value === "number" && entry.value > 0) return entry.value;
	}
	return null;
}

/**
 * Merge a threshold into a domain's failure_patterns, preserving every rule
 * the editor does not manage (advanced rules are still hand-written SQL).
 * `days === null` removes the numeric rule entirely, which drops the domain
 * out of cadence flagging. An existing rule keeps its name — a journal-cadence
 * domain does not silently become an activity-cadence one.
 */
export function withCadenceThresholdDays(
	failurePatterns: unknown,
	days: number | null,
): FailurePattern[] {
	const existing = Array.isArray(failurePatterns) ? failurePatterns.filter(isFailurePattern) : [];
	const others = existing.filter((p) => !isCadenceRule(p.rule));
	if (days === null) return others;
	const previous = existing.find((p) => isCadenceRule(p.rule));
	return [...others, { ...previous, rule: previous?.rule ?? CADENCE_RULES[0], value: days }];
}

/** Read-merge-write of the primary cadence rule. */
export async function setDomainCadence(
	sb: SupabaseClient,
	id: string,
	days: number | null,
): Promise<void> {
	const domain = await getDomain(sb, id);
	if (!domain) throw new ServiceError(`Domain ${id} not found`, "NOT_FOUND");
	unwrap(
		await sb
			.from("stewardship_domains")
			.update({ failure_patterns: withCadenceThresholdDays(domain.failure_patterns, days) })
			.eq("id", id),
	);
}
