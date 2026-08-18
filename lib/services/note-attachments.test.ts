import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocking the port is four plain functions instead of a fake object store —
// the payoff of keeping storage behind lib/storage (docs/adr/0052).
vi.mock("@/lib/storage", () => ({
	putObject: vi.fn(async () => {}),
	getObject: vi.fn(async () => null),
	deleteObjects: vi.fn(async () => {}),
	listPrefix: vi.fn(async () => []),
}));

import {
	removeAllForNote,
	removeAttachment,
	uploadAttachment,
} from "@/lib/services/note-attachments";
import { deleteObjects, listPrefix, putObject } from "@/lib/storage";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";
const BYTES = new Uint8Array([1, 2, 3, 4]);

beforeEach(() => {
	vi.clearAllMocks();
});

/** Records rpc calls; `fails` makes the next rpc return a Postgres error. */
function stubSupabase({ fails = false }: { fails?: boolean } = {}) {
	const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
	const sb = {
		rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
			calls.push({ fn, args });
			return fails ? { data: null, error: { message: "boom" } } : { data: null, error: null };
		}),
	} as unknown as SupabaseClient;
	return { sb, calls };
}

describe("uploadAttachment", () => {
	it("writes the bytes, then the row, and returns the attachment", async () => {
		const { sb, calls } = stubSupabase();
		const attachment = await uploadAttachment(sb, NOTE_ID, {
			bytes: BYTES,
			name: "photo.png",
			contentType: "image/webp",
		});

		expect(putObject).toHaveBeenCalledTimes(1);
		const [key, bytes, contentType] = vi.mocked(putObject).mock.calls[0];
		expect(key).toMatch(new RegExp(`^notes/${NOTE_ID}/[0-9a-f-]{36}\\.webp$`));
		expect(bytes).toBe(BYTES);
		expect(contentType).toBe("image/webp");

		expect(calls).toHaveLength(1);
		expect(calls[0].fn).toBe("note_attachment_add");
		expect(calls[0].args.p_note_id).toBe(NOTE_ID);

		expect(attachment.storage_path).toBe(key);
		expect(attachment.url).toBe(`/api/media/${key}`);
		expect(attachment.size_bytes).toBe(4);
	});

	it("keeps the original filename as metadata, not as the key", async () => {
		const { sb } = stubSupabase();
		const attachment = await uploadAttachment(sb, NOTE_ID, {
			bytes: BYTES,
			name: "../../etc/passwd",
			contentType: "application/pdf",
		});

		expect(attachment.name).toBe("../../etc/passwd");
		expect(attachment.storage_path).not.toContain("..");
		expect(attachment.storage_path.startsWith(`notes/${NOTE_ID}/`)).toBe(true);
	});

	it("persists an app-relative url, so no provider is named in stored data", async () => {
		const { sb } = stubSupabase();
		const attachment = await uploadAttachment(sb, NOTE_ID, {
			bytes: BYTES,
			name: "a.pdf",
			contentType: "application/pdf",
		});
		expect(attachment.url.startsWith("/api/media/")).toBe(true);
		expect(attachment.url).not.toContain("r2.cloudflarestorage.com");
	});

	// The state to avoid: bytes in the bucket that nothing will ever reference.
	it("deletes the uploaded object when the row write fails", async () => {
		const { sb } = stubSupabase({ fails: true });

		await expect(
			uploadAttachment(sb, NOTE_ID, {
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
	it("drops the row first, then the bytes", async () => {
		const { sb, calls } = stubSupabase();
		await removeAttachment(sb, NOTE_ID, "notes/x/a.webp");

		expect(calls[0].fn).toBe("note_attachment_remove");
		expect(calls[0].args).toEqual({
			p_note_id: NOTE_ID,
			p_storage_path: "notes/x/a.webp",
		});
		expect(deleteObjects).toHaveBeenCalledWith(["notes/x/a.webp"]);
	});

	// A dead thumbnail on the page is worse than a leaked object.
	it("does not delete the bytes when the row write fails", async () => {
		const { sb } = stubSupabase({ fails: true });
		await expect(removeAttachment(sb, NOTE_ID, "notes/x/a.webp")).rejects.toThrow();
		expect(deleteObjects).not.toHaveBeenCalled();
	});
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
