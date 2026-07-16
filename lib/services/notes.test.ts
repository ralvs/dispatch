import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	countNeedsReview,
	createNeedsReviewNote,
	createNote,
	deleteNote,
	resolveNeedsReview,
} from "@/lib/services/notes";

// Stub covering the one shape these functions use:
// .from().insert().select().single(). Records every insert payload so tests
// assert on wiring without a real database.
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "note-1", ...row }, error: null })),
					})),
				};
			}),
		})),
	} as unknown as SupabaseClient;
	return { sb, inserts };
}

describe("createNote", () => {
	it("defaults source_type to own_thought and returns the row", async () => {
		const { sb, inserts } = stubSupabase();

		const note = await createNote(sb, { body: "um pensamento" });

		expect(note.id).toBe("note-1");
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({ body: "um pensamento", source_type: "own_thought" });
	});

	it("stores the body verbatim and preserves an explicit source_type", async () => {
		const { sb, inserts } = stubSupabase();

		await createNote(sb, { body: "meeting recap", source_type: "meeting_note" });

		expect(inserts[0]).toMatchObject({ body: "meeting recap", source_type: "meeting_note" });
	});
});

describe("createNeedsReviewNote", () => {
	it("marks needs_review, links the origin capture, and tags the reason", async () => {
		const { sb, inserts } = stubSupabase();

		await createNeedsReviewNote(sb, {
			body: "cria uma tarefa no projeto Foo",
			origin_capture_id: "cap-1",
			proposed_kind: "create_project",
		});

		expect(inserts[0]).toMatchObject({
			body: "cria uma tarefa no projeto Foo",
			needs_review: true,
			origin_capture_id: "cap-1",
			source_type: "own_thought",
		});
		expect(inserts[0].tags).toEqual(["capture:needs_review", "unhandled:create_project"]);
	});

	it("omits the unhandled tag when no proposed_kind is given", async () => {
		const { sb, inserts } = stubSupabase();

		await createNeedsReviewNote(sb, { body: "raw text", origin_capture_id: "cap-2" });

		expect(inserts[0].tags).toEqual(["capture:needs_review"]);
	});
});

// Minimal chainable stub mirroring the shapes resolveNeedsReview/deleteNote/
// countNeedsReview actually call: .from().update().eq(), .from().delete().eq(),
// and the count-only select.
function stubMutationSupabase() {
	const updatePatches: Array<Record<string, unknown>> = [];
	let deleted = false;

	const sb = {
		from: vi.fn(() => ({
			update: vi.fn((patch: Record<string, unknown>) => {
				updatePatches.push(patch);
				return { eq: vi.fn(async () => ({ data: null, error: null })) };
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async () => {
					deleted = true;
					return { data: null, error: null };
				}),
			})),
			select: vi.fn(() => ({
				eq: vi.fn(async () => ({ data: null, error: null, count: 3 })),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, updatePatches, wasDeleted: () => deleted };
}

describe("resolveNeedsReview", () => {
	it("clears needs_review only, preserving the body", async () => {
		const { sb, updatePatches } = stubMutationSupabase();

		await resolveNeedsReview(sb, "note-1");

		expect(updatePatches).toEqual([{ needs_review: false }]);
	});
});

describe("deleteNote", () => {
	it("hard-deletes the row", async () => {
		const { sb, wasDeleted } = stubMutationSupabase();

		await deleteNote(sb, "note-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("countNeedsReview", () => {
	it("returns the count of needs_review notes", async () => {
		const { sb } = stubMutationSupabase();

		const count = await countNeedsReview(sb);

		expect(count).toBe(3);
	});
});
