import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachFilesReply } from "@/lib/attachments";

// The route only translates HTTP (docs/adr/0088): the intake rule and the
// batch are tested in lib/services/note-files.*, so here the module is mocked.

let signedIn = true;
let r2Configured = true;

vi.mock("@/lib/auth", () => ({
	ownerRoute:
		(handler: (req: Request, auth: unknown, ...rest: unknown[]) => Promise<Response>) =>
		async (req: Request, ...rest: unknown[]) => {
			if (!signedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			return handler(req, { claims: { sub: "owner" }, sb: {} }, ...rest);
		},
}));

vi.mock("@/lib/env", () => ({ isR2Configured: () => r2Configured }));
vi.mock("@/lib/invalidate", () => ({ afterMutation: vi.fn() }));
vi.mock("@/lib/services/note-files", () => ({ attachNoteFiles: vi.fn() }));

import { POST } from "@/app/api/notes/[id]/attachments/route";
import { afterMutation } from "@/lib/invalidate";
import { attachNoteFiles } from "@/lib/services/note-files";

const NOTE_ID = "11111111-2222-4333-8444-555555555555";

const LANDED: AttachFilesReply = {
	attached: [
		{
			url: `/api/media/notes/${NOTE_ID}/x.webp`,
			storage_path: `notes/${NOTE_ID}/x.webp`,
			name: "a.png",
			content_type: "image/webp",
			size_bytes: 4,
			uploaded_at: "2026-10-13T12:00:00.000Z",
		},
	] as AttachFilesReply["attached"],
	rejected: [{ name: "b.zip", reason: "Unsupported file type" }],
	write: { rows: [], at: "2026-10-13T12:00:00.000Z" },
};

const NOTHING: AttachFilesReply = {
	attached: [],
	rejected: [{ name: "b.zip", reason: "Unsupported file type" }],
	write: null,
};

function file(name: string): File {
	return new File([new Uint8Array([1, 2, 3])], name, { type: "application/octet-stream" });
}

function post(files: File[], id = NOTE_ID) {
	const form = new FormData();
	for (const f of files) form.append("files", f);
	return POST(
		new Request(`https://app.test/api/notes/${id}/attachments`, { method: "POST", body: form }),
		{ params: Promise.resolve({ id }) },
	);
}

beforeEach(() => {
	signedIn = true;
	r2Configured = true;
	vi.clearAllMocks();
	vi.mocked(attachNoteFiles).mockResolvedValue({ ok: true, reply: LANDED });
});

describe("POST /api/notes/[id]/attachments", () => {
	it("refuses a signed-out request before calling the module", async () => {
		signedIn = false;
		const res = await post([file("a.png")]);
		expect(res.status).toBe(401);
		expect(attachNoteFiles).not.toHaveBeenCalled();
	});

	it("rejects an invalid note id", async () => {
		const res = await post([file("a.png")], "not-a-uuid");
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "Invalid note id" });
		expect(attachNoteFiles).not.toHaveBeenCalled();
	});

	it("503s when storage is not configured", async () => {
		r2Configured = false;
		const res = await post([file("a.png")]);
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: "File storage is not configured" });
		expect(attachNoteFiles).not.toHaveBeenCalled();
	});

	it("400s a body that is not multipart", async () => {
		const res = await POST(
			new Request(`https://app.test/api/notes/${NOTE_ID}/attachments`, {
				method: "POST",
				body: "plain",
				headers: { "content-type": "text/plain" },
			}),
			{ params: Promise.resolve({ id: NOTE_ID }) },
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "Expected multipart form data" });
	});

	it("400s when no files were sent", async () => {
		const res = await post([]);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "No files provided" });
		expect(attachNoteFiles).not.toHaveBeenCalled();
	});

	it("404s for a note that does not exist", async () => {
		vi.mocked(attachNoteFiles).mockResolvedValueOnce({ ok: false, error: "note-not-found" });
		const res = await post([file("a.png")]);
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "Note not found" });
		expect(afterMutation).not.toHaveBeenCalled();
	});

	it("passes the reply through and busts the notes caches once", async () => {
		const res = await post([file("a.png")]);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(LANDED);
		expect(afterMutation).toHaveBeenCalledWith("notes.write");
		expect(afterMutation).toHaveBeenCalledTimes(1);
	});

	it("400s when nothing landed, without busting caches", async () => {
		vi.mocked(attachNoteFiles).mockResolvedValueOnce({ ok: true, reply: NOTHING });
		const res = await post([file("b.zip")]);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual(NOTHING);
		expect(afterMutation).not.toHaveBeenCalled();
	});

	it("hands the files to the module in the order sent", async () => {
		await post([file("one.png"), file("two.pdf"), file("three.md")]);
		const [, id, files] = vi.mocked(attachNoteFiles).mock.calls[0];
		expect(id).toBe(NOTE_ID);
		expect(files.map((f) => f.name)).toEqual(["one.png", "two.pdf", "three.md"]);
	});
});
