import { beforeEach, describe, expect, it, vi } from "vitest";

// removeAllForNote touches storage only, no database. The rpc-backed writes
// run against the local database in note-attachments.int.test.ts.
// Mocking the port is four plain functions instead of a fake object store —
// the payoff of keeping storage behind lib/storage (docs/adr/0052).
vi.mock("@/lib/storage", () => ({
	putObject: vi.fn(async () => {}),
	getObject: vi.fn(async () => null),
	deleteObjects: vi.fn(async () => {}),
	listPrefix: vi.fn(async () => []),
}));

import { removeAllForNote } from "@/lib/services/note-attachments";
import { deleteObjects, listPrefix } from "@/lib/storage";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("removeAllForNote", () => {
	it("sweeps every object under the note prefix", async () => {
		vi.mocked(listPrefix).mockResolvedValueOnce([
			`notes/${NOTE_ID}/a.webp`,
			`notes/${NOTE_ID}/b.pdf`,
		]);

		await removeAllForNote(NOTE_ID);

		expect(listPrefix).toHaveBeenCalledWith(`notes/${NOTE_ID}/`);
		expect(deleteObjects).toHaveBeenCalledWith([
			`notes/${NOTE_ID}/a.webp`,
			`notes/${NOTE_ID}/b.pdf`,
		]);
	});

	it("makes no delete call when the note had no files", async () => {
		vi.mocked(listPrefix).mockResolvedValueOnce([]);
		await removeAllForNote(NOTE_ID);
		expect(deleteObjects).not.toHaveBeenCalled();
	});
});
