import { describe, expect, it } from "vitest";
import { createEntry, deleteEntry, getEntry, listBooks } from "@/lib/services/journal";
import { ownerClient } from "@/test/integration/clients";

describe("journal against the local database", () => {
	it("defaults source to typed and stores text verbatim", async () => {
		const sb = await ownerClient();
		const entry = await createEntry(sb, {
			entry_date: "2026-07-16",
			transcription_text: "hoje foi um bom dia",
		});

		expect(await getEntry(sb, entry.id)).toMatchObject({
			entry_date: "2026-07-16",
			transcription_text: "hoje foi um bom dia",
			source: "typed",
		});
	});

	it("preserves an explicit source, and a deleted entry reads as null", async () => {
		const sb = await ownerClient();
		const entry = await createEntry(sb, {
			entry_date: "2026-07-16",
			transcription_text: "spoken entry",
			source: "voice",
		});
		expect((await getEntry(sb, entry.id))?.source).toBe("voice");

		await deleteEntry(sb, entry.id);
		expect(await getEntry(sb, entry.id)).toBeNull();
	});

	it("lists the books the database holds", async () => {
		const sb = await ownerClient();
		const { data } = await sb.from("journal_books").select("id");

		expect((await listBooks(sb)).map((b) => b.id).sort()).toEqual(
			(data ?? []).map((b) => b.id).sort(),
		);
	});
});
