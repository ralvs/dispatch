import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachNoteFiles } from "@/lib/services/note-files";
import { createNote, getNote } from "@/lib/services/notes";
import { type FakeStorage, fakeStorage } from "@/test/fakes/storage";
import { ownerClient } from "@/test/integration/clients";

// The batch against the real note row, with storage faked through the port
// (docs/adr/0088). The intake rule alone is in note-files.test.ts.

let storage: FakeStorage;

beforeEach(() => {
	storage = fakeStorage();
});

async function png(): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 40, b: 40 } },
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

function pdfBytes(): Uint8Array {
	const bytes = new Uint8Array(32);
	bytes.set(new TextEncoder().encode("%PDF-1.7"), 0);
	return bytes;
}

function file(name: string, type: string, bytes: Uint8Array): File {
	return new File([bytes as unknown as BlobPart], name, { type });
}

async function aNote() {
	return createNote(await ownerClient(), { body: "with files" });
}

describe("attachNoteFiles", () => {
	it("attaches the good files in order, names the rejected one, and reads the note back", async () => {
		const sb = await ownerClient();
		const note = await aNote();

		const result = await attachNoteFiles(
			sb,
			note.id,
			[
				file("photo.png", "image/png", await png()),
				file("bundle.zip", "application/zip", new Uint8Array(32)),
				file("report.pdf", "application/pdf", pdfBytes()),
			],
			{ storage },
		);

		if (!result.ok) throw new Error(result.error);
		const { reply } = result;
		expect(reply.attached.map((a) => a.name)).toEqual(["photo.png", "report.pdf"]);
		expect(reply.rejected).toEqual([{ name: "bundle.zip", reason: "Unsupported file type" }]);
		expect(reply.write?.rows[0]).toMatchObject({ id: note.id });
		expect(reply.write?.rows[0]?.attachments).toHaveLength(2);
		expect(storage.objects.size).toBe(2);
	});

	it("answers note-not-found before touching storage", async () => {
		const result = await attachNoteFiles(
			await ownerClient(),
			"11111111-2222-4333-8444-555555555555",
			[file("report.pdf", "application/pdf", pdfBytes())],
			{ storage },
		);

		expect(result).toEqual({ ok: false, error: "note-not-found" });
		expect(storage.putObject).not.toHaveBeenCalled();
	});

	it("reports an upload failure as a rejection, with no detail", async () => {
		const sb = await ownerClient();
		const note = await aNote();
		storage.putObject.mockRejectedValueOnce(new Error("R2 down"));
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await attachNoteFiles(
			sb,
			note.id,
			[file("report.pdf", "application/pdf", pdfBytes())],
			{ storage },
		);

		log.mockRestore();
		if (!result.ok) throw new Error(result.error);
		expect(result.reply.rejected).toEqual([{ name: "report.pdf", reason: "Upload failed" }]);
		expect(JSON.stringify(result)).not.toContain("R2 down");
		expect((await getNote(sb, note.id))?.attachments ?? []).toEqual([]);
	});

	it("reads nothing back when every file is refused", async () => {
		const note = await aNote();
		const result = await attachNoteFiles(
			await ownerClient(),
			note.id,
			[file("bundle.zip", "application/zip", new Uint8Array(32))],
			{ storage },
		);

		if (!result.ok) throw new Error(result.error);
		expect(result.reply).toEqual({
			attached: [],
			rejected: [{ name: "bundle.zip", reason: "Unsupported file type" }],
			write: null,
		});
	});

	it("stores a .md that arrived with no type as text/markdown", async () => {
		const note = await aNote();
		const result = await attachNoteFiles(
			await ownerClient(),
			note.id,
			[file("notes.md", "", new TextEncoder().encode("# hi"))],
			{ storage },
		);

		if (!result.ok) throw new Error(result.error);
		expect(result.reply.attached[0]?.content_type).toBe("text/markdown");
		expect(storage.putObject.mock.calls[0]?.[2]).toBe("text/markdown");
	});
});
