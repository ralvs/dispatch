import { describe, expect, it } from "vitest";
import { removeAllForNote } from "@/lib/services/note-attachments";
import { fakeStorage } from "@/test/fakes/storage";

// removeAllForNote touches storage only, no database. The rpc-backed writes
// run against the local database in note-attachments.int.test.ts. Storage is
// the in-memory fake, passed in rather than module-mocked (docs/adr/0088).

const NOTE_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_ID = "99999999-2222-4333-8444-555555555555";
const OBJECT = { bytes: new Uint8Array([1]), contentType: "image/webp" };

describe("removeAllForNote", () => {
	it("sweeps every object under the note prefix and nothing else", async () => {
		const storage = fakeStorage({
			[`notes/${NOTE_ID}/a.webp`]: OBJECT,
			[`notes/${NOTE_ID}/b.pdf`]: OBJECT,
			[`notes/${OTHER_ID}/c.webp`]: OBJECT,
		});

		await removeAllForNote(NOTE_ID, { storage });

		expect(storage.listPrefix).toHaveBeenCalledWith(`notes/${NOTE_ID}/`);
		expect(storage.deleteObjects).toHaveBeenCalledWith([
			`notes/${NOTE_ID}/a.webp`,
			`notes/${NOTE_ID}/b.pdf`,
		]);
		expect([...storage.objects.keys()]).toEqual([`notes/${OTHER_ID}/c.webp`]);
	});

	it("makes no delete call when the note had no files", async () => {
		const storage = fakeStorage({ [`notes/${OTHER_ID}/c.webp`]: OBJECT });
		await removeAllForNote(NOTE_ID, { storage });
		expect(storage.deleteObjects).not.toHaveBeenCalled();
	});
});
