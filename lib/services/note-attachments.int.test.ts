import { beforeEach, describe, expect, it } from "vitest";
import { removeAttachment, uploadAttachment } from "@/lib/services/note-attachments";
import { createNote, getNote } from "@/lib/services/notes";
import { type FakeStorage, fakeStorage } from "@/test/fakes/storage";
import { ownerClient, unreachableClient } from "@/test/integration/clients";

// Object storage (R2) is external: an in-memory fake is passed in as the port
// (docs/adr/0088); the note row and its attachments column are real
// (docs/adr/0052).

const BYTES = new Uint8Array([1, 2, 3, 4]);

let storage: FakeStorage;

beforeEach(() => {
	storage = fakeStorage();
});

async function aNote() {
	return createNote(await ownerClient(), { body: "with files" });
}

describe("uploadAttachment", () => {
	it("writes the bytes, then the row, and the note reads the attachment back", async () => {
		const sb = await ownerClient();
		const note = await aNote();

		const attachment = await uploadAttachment(
			sb,
			note.id,
			{ bytes: BYTES, name: "photo.png", contentType: "image/webp" },
			{ storage },
		);

		const [key, bytes, contentType] = storage.putObject.mock.calls[0];
		expect(key).toMatch(new RegExp(`^notes/${note.id}/[0-9a-f-]{36}\\.webp$`));
		expect(bytes).toBe(BYTES);
		expect(contentType).toBe("image/webp");
		expect(storage.objects.get(key)).toEqual({ bytes: BYTES, contentType: "image/webp" });
		expect(attachment).toMatchObject({
			storage_path: key,
			url: `/api/media/${key}`,
			size_bytes: 4,
		});
		// An app-relative url: no storage provider is named in stored data.
		expect((await getNote(sb, note.id))?.attachments).toEqual([
			expect.objectContaining({ storage_path: key, url: `/api/media/${key}`, name: "photo.png" }),
		]);
	});

	it("keeps the original filename as metadata, not as the key", async () => {
		const note = await aNote();
		const attachment = await uploadAttachment(
			await ownerClient(),
			note.id,
			{ bytes: BYTES, name: "../../etc/passwd", contentType: "application/pdf" },
			{ storage },
		);

		expect(attachment.name).toBe("../../etc/passwd");
		expect(attachment.storage_path).not.toContain("..");
		expect(attachment.storage_path.startsWith(`notes/${note.id}/`)).toBe(true);
	});

	// The state to avoid: bytes in the bucket that nothing will ever reference.
	it("deletes the uploaded object when the row write fails", async () => {
		const note = await aNote();

		await expect(
			uploadAttachment(
				unreachableClient(),
				note.id,
				{ bytes: BYTES, name: "a.png", contentType: "image/png" },
				{ storage },
			),
		).rejects.toThrow();

		expect(storage.putObject).toHaveBeenCalledTimes(1);
		expect(storage.objects.size).toBe(0);
	});
});

describe("removeAttachment", () => {
	it("drops the row, then the bytes", async () => {
		const sb = await ownerClient();
		const note = await aNote();
		const attachment = await uploadAttachment(
			sb,
			note.id,
			{ bytes: BYTES, name: "a.webp", contentType: "image/webp" },
			{ storage },
		);

		await removeAttachment(sb, note.id, attachment.storage_path, { storage });

		expect((await getNote(sb, note.id))?.attachments ?? []).toEqual([]);
		expect(storage.objects.has(attachment.storage_path)).toBe(false);
	});

	it("refuses a path from another note and leaves both notes alone", async () => {
		const sb = await ownerClient();
		const mine = await aNote();
		const other = await aNote();
		const theirs = await uploadAttachment(
			sb,
			other.id,
			{ bytes: BYTES, name: "b.pdf", contentType: "application/pdf" },
			{ storage },
		);

		await expect(removeAttachment(sb, mine.id, theirs.storage_path, { storage })).rejects.toThrow(
			"does not belong",
		);

		expect(storage.deleteObjects).not.toHaveBeenCalled();
		expect(storage.objects.has(theirs.storage_path)).toBe(true);
		expect((await getNote(sb, other.id))?.attachments).toEqual([
			expect.objectContaining({ storage_path: theirs.storage_path }),
		]);
	});

	// A dead thumbnail on the page is worse than a leaked object.
	it("does not delete the bytes when the row write fails", async () => {
		const note = await aNote();
		const key = `notes/${note.id}/a.webp`;
		storage = fakeStorage({ [key]: { bytes: BYTES, contentType: "image/webp" } });

		await expect(
			removeAttachment(unreachableClient(), note.id, key, { storage }),
		).rejects.toThrow();

		expect(storage.deleteObjects).not.toHaveBeenCalled();
		expect(storage.objects.has(key)).toBe(true);
	});
});
