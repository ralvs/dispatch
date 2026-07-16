import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createBook, deleteBook, finishBook, startReadingBook } from "@/lib/services/books";

// Stub covering .from().insert().select().single(), .from().update().eq(),
// and .from().delete().eq().
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];
	let deleted = false;

	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "book-1", ...row }, error: null })),
					})),
				};
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updates.push(patch);
				return {
					eq: vi.fn(async () => ({ data: null, error: null })),
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

	return { sb, inserts, updates, wasDeleted: () => deleted };
}

describe("createBook", () => {
	it("stores the title verbatim", async () => {
		const { sb, inserts } = stubSupabase();

		const book = await createBook(sb, { title: "Project Hail Mary" });

		expect(book.id).toBe("book-1");
		expect(inserts[0]).toMatchObject({ title: "Project Hail Mary" });
	});
});

describe("startReadingBook", () => {
	it("sets status to reading and stamps started_at with today in the app timezone", async () => {
		const { sb, updates } = stubSupabase();

		await startReadingBook(sb, "book-1", "America/Sao_Paulo");

		expect(updates[0]).toMatchObject({ status: "reading" });
		expect(typeof updates[0].started_at).toBe("string");
		expect(updates[0].started_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("finishBook", () => {
	it("sets status to finished, stamps finished_at, and accepts rating + summary", async () => {
		const { sb, updates } = stubSupabase();

		await finishBook(sb, "book-1", "America/Sao_Paulo", { rating: 5, my_summary: "Loved it" });

		expect(updates[0]).toMatchObject({
			status: "finished",
			rating: 5,
			my_summary: "Loved it",
		});
		expect(updates[0].finished_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("finishes without rating/summary when not provided", async () => {
		const { sb, updates } = stubSupabase();

		await finishBook(sb, "book-1", "America/Sao_Paulo");

		expect(updates[0]).toMatchObject({ status: "finished" });
		expect(updates[0]).not.toHaveProperty("rating");
	});
});

describe("deleteBook", () => {
	it("hard-deletes the row", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteBook(sb, "book-1");

		expect(wasDeleted()).toBe(true);
	});
});
