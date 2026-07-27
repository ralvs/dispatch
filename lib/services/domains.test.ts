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

// Stub covering .from().insert().select().single() and .from().update().eq().
// These writers used to read the row back first, to refuse the system Inbox
// domain; that domain no longer exists (docs/adr/0025) and they now write
// straight through.
function stubSupabase() {
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
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, updates };
}

describe("createDomain", () => {
	it("stores the given fields", async () => {
		const { sb, inserts } = stubSupabase();

		const domain = await createDomain(sb, { name: "Health" });

		expect(domain.id).toBe("row-1");
		expect(inserts[0]).toMatchObject({ name: "Health" });
	});
});

describe("updateDomain", () => {
	it("updates a domain", async () => {
		const { sb, updates } = stubSupabase();

		await updateDomain(sb, "domain-1", { name: "Health & Fitness" });

		expect(updates[0]).toMatchObject({ name: "Health & Fitness" });
	});
});

describe("archiveDomain", () => {
	it("sets active=false", async () => {
		const { sb, updates } = stubSupabase();

		await archiveDomain(sb, "domain-1");

		expect(updates[0]).toMatchObject({ active: false });
	});
});

describe("markDomainShipped", () => {
	it("stamps last_shipped_at with a timestamp", async () => {
		const { sb, updates } = stubSupabase();

		await markDomainShipped(sb, "domain-1");

		expect(typeof updates[0].last_shipped_at).toBe("string");
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
