import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { vetNoteFile } from "@/lib/services/note-files";

// The intake rule against real bytes and real sharp, with no mocks
// (docs/adr/0088). The batch and storage run in note-files.int.test.ts.

function pngHeader(size = 32): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	return bytes;
}

function pdfBytes(): Uint8Array {
	const bytes = new Uint8Array(32);
	bytes.set(new TextEncoder().encode("%PDF-1.7"), 0);
	return bytes;
}

function gifBytes(): Uint8Array {
	const bytes = new Uint8Array(32);
	bytes.set(new TextEncoder().encode("GIF89a"), 0);
	return bytes;
}

async function realPng(width: number, height: number): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

function file(name: string, type: string, bytes: Uint8Array): File {
	return new File([bytes as unknown as BlobPart], name, { type });
}

async function reason(f: File): Promise<string | undefined> {
	const result = await vetNoteFile(f);
	return result.ok ? undefined : result.rejection.reason;
}

describe("vetNoteFile", () => {
	it("accepts a pdf by its magic bytes, untouched", async () => {
		const bytes = pdfBytes();
		const result = await vetNoteFile(file("report.pdf", "application/pdf", bytes));
		expect(result).toEqual({
			ok: true,
			file: { name: "report.pdf", bytes, contentType: "application/pdf" },
		});
	});

	it("accepts a png by its magic bytes", async () => {
		const result = await vetNoteFile(file("a.png", "image/png", await realPng(10, 10)));
		expect(result.ok).toBe(true);
	});

	it("resolves a .md with no declared type to text/markdown", async () => {
		const result = await vetNoteFile(file("notes.md", "", new TextEncoder().encode("# hi")));
		expect(result.ok && result.file.contentType).toBe("text/markdown");
	});

	it("refuses an unsupported type", async () => {
		const result = await vetNoteFile(file("bundle.zip", "application/zip", new Uint8Array(32)));
		expect(result).toEqual({
			ok: false,
			rejection: { name: "bundle.zip", reason: "Unsupported file type" },
		});
	});

	// Something executable renamed to .pdf must not get through.
	it("refuses a file whose bytes contradict its declared type", async () => {
		expect(await reason(file("evil.pdf", "application/pdf", pngHeader()))).toBe(
			"File contents do not match its type",
		);
	});

	it("refuses a file over 25 MB", async () => {
		expect(await reason(file("huge.png", "image/png", pngHeader(26_214_401)))).toBe(
			"Too large (max 25 MB)",
		);
	});

	it("checks size before type", async () => {
		expect(await reason(file("huge.zip", "application/zip", new Uint8Array(26_214_401)))).toBe(
			"Too large (max 25 MB)",
		);
	});

	it("refuses an empty file", async () => {
		expect(await reason(file("empty.png", "image/png", new Uint8Array(0)))).toBe("Empty file");
	});

	it("downscales a real image to a smaller webp, keeping the client's name", async () => {
		const original = await realPng(3000, 3000);
		const result = await vetNoteFile(file("photo.png", "image/png", original));
		if (!result.ok) throw new Error(result.rejection.reason);
		expect(result.file.name).toBe("photo.png");
		expect(result.file.contentType).toBe("image/webp");
		expect(result.file.bytes.byteLength).toBeLessThan(original.byteLength);
	});

	it("passes a gif through untouched", async () => {
		const bytes = gifBytes();
		const result = await vetNoteFile(file("anim.gif", "image/gif", bytes));
		expect(result).toEqual({
			ok: true,
			file: { name: "anim.gif", bytes, contentType: "image/gif" },
		});
	});

	it("keeps the original bytes when sharp cannot decode the image", async () => {
		const bytes = pngHeader();
		const result = await vetNoteFile(file("broken.png", "image/png", bytes));
		expect(result).toEqual({
			ok: true,
			file: { name: "broken.png", bytes, contentType: "image/png" },
		});
	});
});
