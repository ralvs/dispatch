import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let signedIn = true;

vi.mock("@/lib/auth", () => ({
	ownerRoute:
		(handler: (req: Request, auth: unknown, ...rest: unknown[]) => Promise<Response>) =>
		async (req: Request, ...rest: unknown[]) => {
			if (!signedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			return handler(req, { claims: { sub: "owner" }, sb: {} }, ...rest);
		},
}));

vi.mock("@/lib/env", () => ({ isR2Configured: () => true }));
vi.mock("@/lib/mutation-feedback/invalidate", () => ({ afterMutation: vi.fn() }));
vi.mock("@/lib/services/note-attachments", () => ({
	uploadAttachment: vi.fn(async (_sb, noteId, input) => ({
		url: `/api/media/notes/${noteId}/generated.${input.contentType.split("/")[1]}`,
		storage_path: `notes/${noteId}/generated.${input.contentType.split("/")[1]}`,
		name: input.name,
		content_type: input.contentType,
		size_bytes: input.bytes.byteLength,
	})),
}));
// Identity downscale — lib/images.test.ts already covers the real thing, and
// this keeps the route tests off libvips.
vi.mock("@/lib/images", () => ({
	downscaleImage: vi.fn(async (bytes: Uint8Array) => ({
		bytes,
		contentType: "image/webp" as const,
	})),
}));

import { POST } from "@/app/api/notes/[id]/attachments/route";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { uploadAttachment } from "@/lib/services/note-attachments";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";

function pngBytes(size = 32): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	return bytes;
}

function pdfBytes(): Uint8Array {
	const bytes = new Uint8Array(32);
	bytes.set(new TextEncoder().encode("%PDF-1.7"), 0);
	return bytes;
}

function post(files: File[], id = NOTE_ID) {
	const form = new FormData();
	for (const file of files) form.append("files", file);
	return POST(
		new Request(`https://app.test/api/notes/${id}/attachments`, { method: "POST", body: form }),
		{ params: Promise.resolve({ id }) },
	);
}

function file(name: string, type: string, bytes: Uint8Array): File {
	return new File([bytes as unknown as BlobPart], name, { type });
}

beforeEach(() => {
	signedIn = true;
	vi.clearAllMocks();
});

describe("POST /api/notes/[id]/attachments", () => {
	it("refuses a signed-out request before touching storage", async () => {
		signedIn = false;
		const res = await post([file("a.png", "image/png", pngBytes())]);
		expect(res.status).toBe(401);
		expect(uploadAttachment).not.toHaveBeenCalled();
	});

	it("rejects an invalid note id", async () => {
		const res = await post([file("a.png", "image/png", pngBytes())], "not-a-uuid");
		expect(res.status).toBe(400);
		expect(uploadAttachment).not.toHaveBeenCalled();
	});

	it("attaches an image, a pdf and a markdown file in one batch", async () => {
		const res = await post([
			file("photo.png", "image/png", pngBytes()),
			file("report.pdf", "application/pdf", pdfBytes()),
			file("notes.md", "", new TextEncoder().encode("# hi")),
		]);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.attached).toHaveLength(3);
		expect(body.rejected).toHaveLength(0);
		expect(body.attached.map((a: { name: string }) => a.name)).toEqual([
			"photo.png",
			"report.pdf",
			"notes.md",
		]);
		// The .md arrived with no content type at all and still resolved.
		expect(vi.mocked(uploadAttachment).mock.calls[2][2].contentType).toBe("text/markdown");
	});

	it("busts the notes caches once, only when something landed", async () => {
		await post([file("a.png", "image/png", pngBytes())]);
		expect(afterMutation).toHaveBeenCalledWith("notes.write", { id: NOTE_ID });
		expect(afterMutation).toHaveBeenCalledTimes(1);
	});

	it("rejects an unsupported type without calling storage", async () => {
		const res = await post([file("bundle.zip", "application/zip", new Uint8Array(32))]);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.attached).toHaveLength(0);
		expect(body.rejected[0]).toEqual({ name: "bundle.zip", reason: "Unsupported file type" });
		expect(uploadAttachment).not.toHaveBeenCalled();
		expect(afterMutation).not.toHaveBeenCalled();
	});

	// Something executable renamed to .pdf must not get through.
	it("rejects a file whose bytes contradict its declared type", async () => {
		const res = await post([file("evil.pdf", "application/pdf", pngBytes())]);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.rejected[0].reason).toBe("File contents do not match its type");
		expect(uploadAttachment).not.toHaveBeenCalled();
	});

	// A genuinely oversized file, not a faked .size — the property is
	// recomputed when the multipart body is parsed, so a stub would sail
	// straight past the guard and prove nothing.
	it("rejects an oversized file before handing it to storage", async () => {
		const res = await post([file("huge.png", "image/png", pngBytes(26_214_401))]);
		const body = await res.json();
		expect(body.rejected[0].reason).toMatch(/Too large/);
		expect(uploadAttachment).not.toHaveBeenCalled();
	});

	it("rejects an empty file", async () => {
		const res = await post([file("empty.png", "image/png", new Uint8Array(0))]);
		const body = await res.json();
		expect(body.rejected[0].reason).toBe("Empty file");
	});

	// Partial success is the case worth getting right: keep the good ones,
	// name the bad one.
	it("keeps the good files and names the rejected one", async () => {
		const res = await post([
			file("photo.png", "image/png", pngBytes()),
			file("bundle.zip", "application/zip", new Uint8Array(32)),
			file("report.pdf", "application/pdf", pdfBytes()),
		]);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.attached.map((a: { name: string }) => a.name)).toEqual(["photo.png", "report.pdf"]);
		expect(body.rejected).toEqual([{ name: "bundle.zip", reason: "Unsupported file type" }]);
		expect(afterMutation).toHaveBeenCalledTimes(1);
	});

	it("400s when no files were sent", async () => {
		const res = await POST(
			new Request(`https://app.test/api/notes/${NOTE_ID}/attachments`, {
				method: "POST",
				body: new FormData(),
			}),
			{ params: Promise.resolve({ id: NOTE_ID }) },
		);
		expect(res.status).toBe(400);
	});

	it("reports an upload failure as a rejection rather than a 500", async () => {
		vi.mocked(uploadAttachment).mockRejectedValueOnce(new Error("R2 down"));
		const res = await post([file("a.png", "image/png", pngBytes())]);
		const body = await res.json();
		expect(body.rejected[0]).toEqual({ name: "a.png", reason: "Upload failed" });
		// The underlying error text must not reach the client.
		expect(JSON.stringify(body)).not.toContain("R2 down");
	});
});
