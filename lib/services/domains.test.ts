import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	archiveDomain,
	createDomain,
	markDomainShipped,
	updateDomain,
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
