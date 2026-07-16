import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createEntry, deleteEntry, listBooks } from "@/lib/services/journal";

// Stub covering .from().insert().select().single(), .from().delete().eq(),
// and .from().select().order().
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	let deleted = false;

	const sb = {
		from: vi.fn((table: string) => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "entry-1", ...row }, error: null })),
					})),
				};
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async () => {
					deleted = true;
					return { data: null, error: null };
				}),
			})),
			select: vi.fn(() => ({
				order: vi.fn(function order() {
					// listBooks chains a single .order() call.
					return Promise.resolve({ data: table === "journal_books" ? [] : [], error: null });
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, wasDeleted: () => deleted };
}

describe("createEntry", () => {
	it("defaults source to typed and stores text verbatim", async () => {
		const { sb, inserts } = stubSupabase();

		const entry = await createEntry(sb, {
			entry_date: "2026-07-16",
			transcription_text: "hoje foi um bom dia",
		});

		expect(entry.id).toBe("entry-1");
		expect(inserts[0]).toMatchObject({
			entry_date: "2026-07-16",
			transcription_text: "hoje foi um bom dia",
			source: "typed",
		});
	});

	it("preserves an explicit source (e.g. voice capture)", async () => {
		const { sb, inserts } = stubSupabase();

		await createEntry(sb, {
			entry_date: "2026-07-16",
			transcription_text: "spoken entry",
			source: "voice",
		});

		expect(inserts[0]).toMatchObject({ source: "voice" });
	});
});

describe("deleteEntry", () => {
	it("hard-deletes the row", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deleteEntry(sb, "entry-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("listBooks", () => {
	it("returns an empty list when no books exist", async () => {
		const { sb } = stubSupabase();

		const books = await listBooks(sb);

		expect(books).toEqual([]);
	});
});
