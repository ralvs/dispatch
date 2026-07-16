import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createAnnotation, createQuote, deleteQuote } from "@/lib/services/quotes";

// Stub covering .from().insert().select().single() and .from().delete().eq().
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	let deleted = false;

	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "quote-1", ...row }, error: null })),
					})),
				};
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async () => {
					deleted = true;
					return { data: null, error: null };
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, wasDeleted: () => deleted };
}

describe("createQuote", () => {
	it("defaults added_via to manual and stores text verbatim", async () => {
		const { sb, inserts } = stubSupabase();

		const quote = await createQuote(sb, { text: "a quotation" });

		expect(quote.id).toBe("quote-1");
		expect(inserts[0]).toMatchObject({ text: "a quotation", added_via: "manual" });
	});

	it("preserves an explicit added_via (e.g. voice capture)", async () => {
		const { sb, inserts } = stubSupabase();

		await createQuote(sb, { text: "spoken quote", added_via: "voice" });

		expect(inserts[0]).toMatchObject({ added_via: "voice" });
	});
});

describe("deleteQuote", () => {
	it("hard-deletes the row (annotations cascade via FK)", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteQuote(sb, "quote-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("createAnnotation", () => {
	it("stores the annotation body verbatim, linked to the quote", async () => {
		const { sb, inserts } = stubSupabase();

		await createAnnotation(sb, { quote_id: "quote-1", body: "this hit different" });

		expect(inserts[0]).toMatchObject({ quote_id: "quote-1", body: "this hit different" });
	});
});
