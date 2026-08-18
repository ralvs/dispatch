import { describe, expect, it } from "vitest";
import {
	ATTACHMENT_MAX_BYTES,
	attachmentKind,
	bytesMatchContentType,
	formatBytes,
	mediaUrl,
	normalizeContentType,
	noteStoragePrefix,
	storageKey,
} from "@/lib/attachments";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";

function withMagic(prefix: number[], length = 16): Uint8Array {
	const bytes = new Uint8Array(length);
	bytes.set(prefix, 0);
	return bytes;
}

const PNG = withMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = withMagic([0xff, 0xd8, 0xff, 0xe0]);
const PDF = withMagic([...new TextEncoder().encode("%PDF-1.7")]);

describe("normalizeContentType", () => {
	it("takes the declared type when it is allowed", () => {
		expect(normalizeContentType("image/png", "a.png")).toBe("image/png");
	});

	it("strips a charset parameter", () => {
		expect(normalizeContentType("text/markdown; charset=utf-8", "a.md")).toBe("text/markdown");
	});

	// The reason this function exists: .md arrives under four different
	// content types depending on OS and drag source.
	it.each([
		["text/markdown", "text/markdown"],
		["text/plain", "text/plain"],
		["application/octet-stream", "text/markdown"],
		["", "text/markdown"],
		[null, "text/markdown"],
	])("resolves a .md declared as %s", (declared, expected) => {
		expect(normalizeContentType(declared, "notes.md")).toBe(expected);
	});

	it("falls back to the extension when the declared type is not allowed", () => {
		expect(normalizeContentType("application/x-weird", "scan.pdf")).toBe("application/pdf");
	});

	it("returns null when neither the type nor the extension is allowed", () => {
		expect(normalizeContentType("application/zip", "bundle.zip")).toBeNull();
		expect(normalizeContentType("", "run.exe")).toBeNull();
	});

	it("is case-insensitive on both halves", () => {
		expect(normalizeContentType("IMAGE/PNG", "A.PNG")).toBe("image/png");
		expect(normalizeContentType("", "PHOTO.JPEG")).toBe("image/jpeg");
	});
});

describe("bytesMatchContentType", () => {
	it("accepts bytes that match the claimed type", () => {
		expect(bytesMatchContentType(PNG, "image/png")).toBe(true);
		expect(bytesMatchContentType(JPEG, "image/jpeg")).toBe(true);
		expect(bytesMatchContentType(PDF, "application/pdf")).toBe(true);
	});

	// The attack this blocks: something executable renamed to .pdf.
	it("rejects bytes that contradict the claimed type", () => {
		expect(bytesMatchContentType(PNG, "application/pdf")).toBe(false);
		expect(bytesMatchContentType(withMagic([0x4d, 0x5a]), "application/pdf")).toBe(false);
	});

	it("accepts text on extension alone, since text has no magic number", () => {
		const text = new TextEncoder().encode("# hello");
		expect(bytesMatchContentType(text, "text/markdown")).toBe(true);
		expect(bytesMatchContentType(new Uint8Array(0), "text/plain")).toBe(true);
	});

	it("rejects a truncated file", () => {
		expect(bytesMatchContentType(new Uint8Array([0x89, 0x50]), "image/png")).toBe(false);
	});

	it("treats heic and heif as one container", () => {
		const heic = new Uint8Array(16);
		heic.set(new TextEncoder().encode("ftypheic"), 4);
		expect(bytesMatchContentType(heic, "image/heic")).toBe(true);
		expect(bytesMatchContentType(heic, "image/heif")).toBe(true);
	});
});

describe("storageKey", () => {
	it("never puts the client filename in the key", () => {
		const key = storageKey(NOTE_ID, "image/png");
		expect(key).not.toContain("evil");
		expect(key).toMatch(new RegExp(`^notes/${NOTE_ID}/[0-9a-f-]{36}\\.png$`));
	});

	it("cannot escape the note prefix", () => {
		const key = storageKey(NOTE_ID, "application/pdf");
		expect(key).not.toContain("..");
		expect(key.startsWith(noteStoragePrefix(NOTE_ID))).toBe(true);
	});

	it("is unique per call", () => {
		expect(storageKey(NOTE_ID, "image/png")).not.toBe(storageKey(NOTE_ID, "image/png"));
	});

	it("normalizes the extension", () => {
		expect(storageKey(NOTE_ID, "image/jpeg").endsWith(".jpg")).toBe(true);
	});
});

describe("mediaUrl", () => {
	it("is app-relative, so no provider appears in stored data", () => {
		const url = mediaUrl(`notes/${NOTE_ID}/abc.png`);
		expect(url).toBe(`/api/media/notes/${NOTE_ID}/abc.png`);
		expect(url).not.toContain("r2.cloudflarestorage.com");
	});
});

describe("attachmentKind", () => {
	it("sorts each allowed type into a row shape", () => {
		expect(attachmentKind("image/webp")).toBe("image");
		expect(attachmentKind("application/pdf")).toBe("pdf");
		expect(attachmentKind("text/markdown")).toBe("text");
	});
});

describe("formatBytes", () => {
	it.each([
		[0, "0 B"],
		[512, "512 B"],
		[1024, "1 KB"],
		[867_123, "847 KB"],
		[2_517_000, "2.4 MB"],
	])("formats %i as %s", (input, expected) => {
		expect(formatBytes(input)).toBe(expected);
	});

	it("returns empty for nonsense rather than NaN", () => {
		expect(formatBytes(Number.NaN)).toBe("");
		expect(formatBytes(-1)).toBe("");
	});
});

describe("ATTACHMENT_MAX_BYTES", () => {
	it("matches the 25mb Server Action cap in next.config.ts", () => {
		expect(ATTACHMENT_MAX_BYTES).toBe(26_214_400);
	});
});
