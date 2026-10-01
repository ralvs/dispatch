import { describe, expect, it } from "vitest";
import {
	countNeedsReview,
	createNote,
	deleteNote,
	getNote,
	listNotes,
	resolveNeedsReview,
	setPin,
	updateNote,
} from "@/lib/services/notes";
import { ownerClient } from "@/test/integration/clients";

// The writes the notes actions make, and the row they read back for the
// entity store (#27). The stub-based cases in notes.test.ts move here in #18.

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
