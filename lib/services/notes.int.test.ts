import { describe, expect, it } from "vitest";
import {
	countNeedsReview,
	createNeedsReviewNote,
	createNote,
	deleteNote,
	getNote,
	listNotes,
	resolveNeedsReview,
	setPin,
	updateNote,
} from "@/lib/services/notes";
import { createPerson } from "@/lib/services/people";
import { ownerClient } from "@/test/integration/clients";

// The writes the notes actions make, and the row they read back for the
// entity store (#27).

describe("notes against the local database", () => {
	it("a pin is a precondition write; the row read back says where it stands", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { body: "Pin me" });

		expect(await setPin(sb, n.id, true)).toEqual({ applied: true });
		const pinned = await getNote(sb, n.id);
		expect(pinned?.pinned_at).not.toBeNull();
		// A replayed pin matches no unpinned row and keeps the first stamp (ADR-0037).
		expect(await setPin(sb, n.id, true)).toEqual({ applied: false });
		expect((await getNote(sb, n.id))?.pinned_at).toBe(pinned?.pinned_at);
	});

	it("filing a flagged note moves it out of the band and the count", async () => {
		const sb = await ownerClient();
		const before = await countNeedsReview(sb);
		const n = await createNote(sb, { body: "Unplaced", needs_review: true });
		expect(await countNeedsReview(sb)).toBe(before + 1);

		await resolveNeedsReview(sb, n.id);
		expect((await getNote(sb, n.id))?.needs_review).toBe(false);
		expect(await countNeedsReview(sb)).toBe(before);
		const band = await listNotes(sb, { needsReview: true });
		expect(band.some((r) => r.id === n.id)).toBe(false);
	});

	it("a save's title and body come back on the row; a deleted note reads as null", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { body: "" });
		await updateNote(sb, n.id, { title: "Groceries", body: "- eggs" });
		expect(await getNote(sb, n.id)).toMatchObject({ title: "Groceries", body: "- eggs" });

		await deleteNote(sb, n.id);
		expect(await getNote(sb, n.id)).toBeNull();
	});
});

describe("createNote", () => {
	it("defaults source_type to own_thought and keeps an explicit one", async () => {
		const sb = await ownerClient();
		const plain = await createNote(sb, { body: "um pensamento" });
		const recap = await createNote(sb, { body: "meeting recap", source_type: "meeting_note" });

		expect(await getNote(sb, plain.id)).toMatchObject({
			body: "um pensamento",
			source_type: "own_thought",
		});
		expect(await getNote(sb, recap.id)).toMatchObject({ source_type: "meeting_note" });
	});

	it("writes a mention row for an @Name in the body", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const n = await createNote(sb, { body: "falar com @Ana" });

		const { data } = await sb.from("mentions").select("person_id").eq("note_id", n.id);
		expect(data).toEqual([{ person_id: ana.id }]);
	});
});

describe("createNeedsReviewNote", () => {
	async function tagsOf(input: Parameters<typeof createNeedsReviewNote>[1]) {
		const sb = await ownerClient();
		const n = await createNeedsReviewNote(sb, input);
		const { data } = await sb
			.from("notes")
			.select("body, needs_review, source_type, tags")
			.eq("id", n.id)
			.single();
		return data;
	}

	it("marks needs_review and tags proposed_kind", async () => {
		expect(
			await tagsOf({ body: "cria uma tarefa no projeto Foo", proposed_kind: "create_project" }),
		).toEqual({
			body: "cria uma tarefa no projeto Foo",
			needs_review: true,
			source_type: "own_thought",
			tags: ["capture:needs_review", "unhandled:create_project"],
		});
	});

	it.each([
		["stores a structured reason as a tag", "parser_failed", "reason:parser_failed"],
		[
			"collapses a freeform execute error to reason:execute_failed",
			"iCloud CalDAV is not configured; event not created",
			"reason:execute_failed",
		],
	])("%s", async (_name, reason, tag) => {
		expect((await tagsOf({ body: "raw text", reason }))?.tags).toEqual([
			"capture:needs_review",
			tag,
		]);
	});

	it("omits reason and unhandled tags when neither is given", async () => {
		expect((await tagsOf({ body: "raw text" }))?.tags).toEqual(["capture:needs_review"]);
	});
});

describe("listNotes", () => {
	it("filters on needs_review only when asked", async () => {
		const sb = await ownerClient();
		const flagged = await createNote(sb, { body: "flagged", needs_review: true });
		const plain = await createNote(sb, { body: "plain" });

		const ids = async (f?: { needsReview?: boolean }) => (await listNotes(sb, f)).map((n) => n.id);
		expect(await ids()).toEqual(expect.arrayContaining([flagged.id, plain.id]));
		expect(await ids({ needsReview: true })).toEqual([flagged.id]);
		expect(await ids({ needsReview: false })).not.toContain(flagged.id);
		expect(await ids({ needsReview: false })).toContain(plain.id);
	});
});

describe("resolveNeedsReview", () => {
	it("clears needs_review only, preserving the body", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { body: "keep me", needs_review: true });

		await resolveNeedsReview(sb, n.id);

		expect(await getNote(sb, n.id)).toMatchObject({ body: "keep me", needs_review: false });
	});
});

describe("setPin", () => {
	it("unpins a pinned note, and a replayed unpin matches nothing", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { body: "pinned" });
		await setPin(sb, n.id, true);

		expect(await setPin(sb, n.id, false)).toEqual({ applied: true });
		expect((await getNote(sb, n.id))?.pinned_at).toBeNull();
		expect(await setPin(sb, n.id, false)).toEqual({ applied: false });
	});

	// A missing note is a no-op, not a thrown "Note not found" that would toast
	// and revert an optimistic row that no longer exists.
	it("reports a missing note as unapplied instead of throwing", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { body: "gone" });
		await deleteNote(sb, n.id);

		await expect(setPin(sb, n.id, true)).resolves.toEqual({ applied: false });
	});
});
