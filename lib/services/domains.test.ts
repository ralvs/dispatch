import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { cadenceThresholdDays } from "@/lib/services/briefing";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	updateDomain,
	withCadenceThresholdDays,
} from "@/lib/services/domains";
import { ServiceError } from "@/lib/services/errors";

// Stub covering .from().insert().select().single(), .from().update().eq(),
// and .from().select().eq().maybeSingle() (used by the is_system guard).
function stubSupabase(domain: Record<string, unknown> | null) {
	const inserts: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];

	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "row-1", ...row }, error: null })),
					})),
				};
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updates.push(patch);
				return {
					eq: vi.fn(async () => ({ data: null, error: null })),
				};
			}),
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => ({ data: domain, error: null })),
				})),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, updates };
}

describe("createDomain", () => {
	it("stores the given fields", async () => {
		const { sb, inserts } = stubSupabase(null);

		const domain = await createDomain(sb, { name: "Health" });

		expect(domain.id).toBe("row-1");
		expect(inserts[0]).toMatchObject({ name: "Health" });
	});
});

describe("updateDomain", () => {
	it("updates a normal domain", async () => {
		const { sb, updates } = stubSupabase({ id: "domain-1", is_system: false });

		await updateDomain(sb, "domain-1", { name: "Health & Fitness" });

		expect(updates[0]).toMatchObject({ name: "Health & Fitness" });
	});

	it("rejects editing the system Inbox domain", async () => {
		const { sb } = stubSupabase({ id: "inbox", is_system: true });

		await expect(updateDomain(sb, "inbox", { name: "Renamed" })).rejects.toThrow(ServiceError);
	});
});

describe("archiveDomain", () => {
	it("sets active=false on a normal domain", async () => {
		const { sb, updates } = stubSupabase({ id: "domain-1", is_system: false });

		await archiveDomain(sb, "domain-1");

		expect(updates[0]).toMatchObject({ active: false });
	});

	it("rejects archiving the system Inbox domain", async () => {
		const { sb } = stubSupabase({ id: "inbox", is_system: true });

		await expect(archiveDomain(sb, "inbox")).rejects.toThrow(ServiceError);
	});
});

describe("markDomainShipped", () => {
	it("stamps last_shipped_at with a timestamp", async () => {
		const { sb, updates } = stubSupabase({ id: "domain-1", is_system: false });

		await markDomainShipped(sb, "domain-1");

		expect(typeof updates[0].last_shipped_at).toBe("string");
	});

	it("rejects stamping the system Inbox domain", async () => {
		const { sb } = stubSupabase({ id: "inbox", is_system: true });

		await expect(markDomainShipped(sb, "inbox")).rejects.toThrow(ServiceError);
	});
});

describe("withCadenceThresholdDays", () => {
	it("writes a rule onto a domain that had none", () => {
		expect(withCadenceThresholdDays([], 7)).toEqual([{ rule: "no_activity_days", value: 7 }]);
	});

	it("replaces the value but keeps the existing rule name", () => {
		expect(withCadenceThresholdDays([{ rule: "days_since_journal", value: 14 }], 3)).toEqual([
			{ rule: "days_since_journal", value: 3 },
		]);
	});

	it("leaves rules the editor does not manage alone", () => {
		const patterns = [
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 7 },
		];
		expect(withCadenceThresholdDays(patterns, 10)).toEqual([
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 10 },
		]);
	});

	it("removes the numeric rule when cleared, keeping the rest", () => {
		const patterns = [
			{ rule: "no_open_tasks_days", value: 30 },
			{ rule: "no_activity_days", value: 7 },
		];
		expect(withCadenceThresholdDays(patterns, null)).toEqual([
			{ rule: "no_open_tasks_days", value: 30 },
		]);
	});

	it("survives a malformed failure_patterns value", () => {
		expect(withCadenceThresholdDays(null, 5)).toEqual([{ rule: "no_activity_days", value: 5 }]);
		expect(withCadenceThresholdDays([1, "x", null], 5)).toEqual([
			{ rule: "no_activity_days", value: 5 },
		]);
	});

	it("round-trips through the reader that decides In brief", () => {
		expect(cadenceThresholdDays(withCadenceThresholdDays([], 9))).toBe(9);
		expect(
			cadenceThresholdDays(withCadenceThresholdDays([{ rule: "no_activity_days" }], null)),
		).toBe(null);
	});
});
