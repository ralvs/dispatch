import { beforeEach, describe, expect, it, vi } from "vitest";

// Object storage (R2) is external: the port's four functions are faked, the
// note row and its attachments column are real (docs/adr/0052).
vi.mock("@/lib/storage", () => ({
	putObject: vi.fn(async () => {}),
	getObject: vi.fn(async () => null),
	deleteObjects: vi.fn(async () => {}),
	listPrefix: vi.fn(async () => []),
}));

import { removeAttachment, uploadAttachment } from "@/lib/services/note-attachments";
import { createNote, getNote } from "@/lib/services/notes";
import { deleteObjects, putObject } from "@/lib/storage";
import { ownerClient, unreachableClient } from "@/test/integration/clients";

const BYTES = new Uint8Array([1, 2, 3, 4]);

beforeEach(() => {
	vi.clearAllMocks();
});

async function aNote() {
	return createNote(await ownerClient(), { body: "with files" });
}

describe("uploadAttachment", () => {
	it("writes the bytes, then the row, and the note reads the attachment back", async () => {
		const sb = await ownerClient();
		const note = await aNote();

		const attachment = await uploadAttachment(sb, note.id, {
			bytes: BYTES,
			name: "photo.png",
			contentType: "image/webp",
		});

		const [key, bytes, contentType] = vi.mocked(putObject).mock.calls[0];
		expect(key).toMatch(new RegExp(`^notes/${note.id}/[0-9a-f-]{36}\\.webp$`));
		expect(bytes).toBe(BYTES);
		expect(contentType).toBe("image/webp");
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
		const attachment = await uploadAttachment(await ownerClient(), note.id, {
			bytes: BYTES,
			name: "../../etc/passwd",
			contentType: "application/pdf",
		});

		expect(attachment.name).toBe("../../etc/passwd");
		expect(attachment.storage_path).not.toContain("..");
		expect(attachment.storage_path.startsWith(`notes/${note.id}/`)).toBe(true);
	});

	// The state to avoid: bytes in the bucket that nothing will ever reference.
	it("deletes the uploaded object when the row write fails", async () => {
		const note = await aNote();

		await expect(
			uploadAttachment(unreachableClient(), note.id, {
				bytes: BYTES,
				name: "a.png",
				contentType: "image/png",
			}),
		).rejects.toThrow();

		const key = vi.mocked(putObject).mock.calls[0][0];
		expect(deleteObjects).toHaveBeenCalledWith([key]);
	});
});

describe("removeAttachment", () => {
	it("drops the row, then the bytes", async () => {
		const sb = await ownerClient();
		const note = await aNote();
		const attachment = await uploadAttachment(sb, note.id, {
			bytes: BYTES,
			name: "a.webp",
			contentType: "image/webp",
		});

		await removeAttachment(sb, note.id, attachment.storage_path);

		expect((await getNote(sb, note.id))?.attachments ?? []).toEqual([]);
		expect(deleteObjects).toHaveBeenCalledWith([attachment.storage_path]);
	});

	// A dead thumbnail on the page is worse than a leaked object.
	it("does not delete the bytes when the row write fails", async () => {
		const note = await aNote();
		await expect(
			removeAttachment(unreachableClient(), note.id, `notes/${note.id}/a.webp`),
		).rejects.toThrow();
		expect(deleteObjects).not.toHaveBeenCalled();
	});
});
