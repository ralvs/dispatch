import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	countNeedsReview,
	createNeedsReviewNote,
	createNote,
	deleteNote,
	listNotes,
	resolveNeedsReview,
	setPin,
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

// Minimal chainable stub mirroring the read path: .from().select().order()
// (pinned_at) .order() (created_at) and an optional trailing .eq() when a
// needsReview filter is applied. Both the second .order() result and the
// .eq() result are awaitable directly, matching how listNotes conditionally
// chains .eq() before awaiting the query.
function stubListSupabase() {
	const eqCalls: Array<[string, unknown]> = [];
	const result = Promise.resolve({ data: [], error: null });
	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				order: vi.fn(() => ({
					order: vi.fn(() =>
						Object.assign(Promise.resolve({ data: [], error: null }), {
							eq: vi.fn((col: string, val: unknown) => {
								eqCalls.push([col, val]);
								return result;
							}),
						}),
					),
				})),
			})),
		})),
	} as unknown as SupabaseClient;
	return { sb, eqCalls };
}

describe("listNotes", () => {
	it("applies no needs_review filter by default", async () => {
		const { sb, eqCalls } = stubListSupabase();

		await listNotes(sb);

		expect(eqCalls).toEqual([]);
	});

	it("filters to needs_review = true", async () => {
		const { sb, eqCalls } = stubListSupabase();

		await listNotes(sb, { needsReview: true });

		expect(eqCalls).toEqual([["needs_review", true]]);
	});

	it("filters to needs_review = false", async () => {
		const { sb, eqCalls } = stubListSupabase();

		await listNotes(sb, { needsReview: false });

		expect(eqCalls).toEqual([["needs_review", false]]);
	});
});

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

// Chainable stub covering setPin's single call shape:
// .from().update().eq()…​.select(). `updated` is what the UPDATE…RETURNING
// resolves to — an empty array is a guard that matched nothing. A top-level
// select() would mean setPin still reads before it writes, so it is recorded
// too. Mirrors lib/services/tasks.test.ts's stubSupabase.
function stubPinSupabase(updated: unknown[] = [{ id: "note-1" }]) {
	const updatePatches: Array<Record<string, unknown>> = [];
	const predicates: Array<{ op: string; args: unknown[] }> = [];
	const reads = { count: 0 };

	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => {
				reads.count += 1;
				return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })) };
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updatePatches.push(patch);
				// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
				const builder: any = {};
				for (const op of ["eq", "is", "not"]) {
					builder[op] = (...args: unknown[]) => {
						predicates.push({ op, args });
						return builder;
					};
				}
				builder.select = async () => ({ data: updated, error: null });
				return builder;
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, updatePatches, predicates, reads };
}

describe("setPin", () => {
	it("pins an unpinned note by stamping pinned_at, without reading first", async () => {
		const { sb, updatePatches, reads } = stubPinSupabase();

		const result = await setPin(sb, "note-1", true);

		expect(result).toEqual({ applied: true });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0].pinned_at).toEqual(expect.any(String));
		expect(reads.count).toBe(0);
	});

	it("unpins a pinned note by clearing pinned_at", async () => {
		const { sb, updatePatches } = stubPinSupabase();

		await setPin(sb, "note-1", false);

		expect(updatePatches).toEqual([{ pinned_at: null }]);
	});

	// Guarding on nullness rather than the timestamp value: a timestamptz
	// round-tripped through JS won't compare equal reliably, and nullness is the
	// whole of the pin state.
	it("guards each direction on the state it is moving away from", async () => {
		const pinning = stubPinSupabase();
		await setPin(pinning.sb, "note-1", true);
		expect(pinning.predicates).toContainEqual({ op: "is", args: ["pinned_at", null] });

		const unpinning = stubPinSupabase();
		await setPin(unpinning.sb, "note-1", false);
		expect(unpinning.predicates).toContainEqual({ op: "not", args: ["pinned_at", "is", null] });
	});

	// A stale second surface re-pinning an already-pinned note used to silently
	// unpin it. Now it matches nothing — pin order survives — and a missing note
	// is a no-op rather than a thrown "Note not found" that would toast and
	// revert an optimistic row that no longer exists.
	it("reports a guard that matched nothing instead of throwing", async () => {
		const { sb } = stubPinSupabase([]);

		await expect(setPin(sb, "missing", true)).resolves.toEqual({ applied: false });
	});
});

describe("countNeedsReview", () => {
	it("returns the count of needs_review notes", async () => {
		const { sb } = stubMutationSupabase();

		const count = await countNeedsReview(sb);

		expect(count).toBe(3);
	});
});
