import { NextResponse } from "next/server";
import { z } from "zod";
import {
	ATTACHMENT_MAX_BYTES,
	attachmentKind,
	bytesMatchContentType,
	formatBytes,
	normalizeContentType,
} from "@/lib/attachments";
import { ownerRoute } from "@/lib/auth";
import { isR2Configured } from "@/lib/env";
import { downscaleImage } from "@/lib/images";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import type { Attachment } from "@/lib/schemas/note";
import { uploadAttachment } from "@/lib/services/note-attachments";

/*
 * The write side of note attachments (docs/adr/0052).
 *
 * A route rather than a server action because this carries binary and wants to
 * answer with the created rows; removal is a server action, matching the link
 * rail next to it. Owner-checked first line (iron rule #2), and the note id is
 * validated before anything touches storage.
 *
 * Partial success is a real outcome here: dropping five files where one is a
 * .zip should attach four and say which one it refused, not fail the batch.
 */

type Rejection = { name: string; reason: string };

export const POST = ownerRoute(
	async (request, { sb }, ctx: { params: Promise<{ id: string }> }) => {
		const { id } = await ctx.params;
		const parsedId = z.uuid().safeParse(id);
		if (!parsedId.success) {
			return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
		}
		if (!isR2Configured()) {
			return NextResponse.json({ error: "File storage is not configured" }, { status: 503 });
		}

		const form = await request.formData().catch(() => null);
		if (!form) {
			return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
		}

		const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
		if (files.length === 0) {
			return NextResponse.json({ error: "No files provided" }, { status: 400 });
		}

		const attached: Attachment[] = [];
		const rejected: Rejection[] = [];

		for (const file of files) {
			const result = await ingest(sb, parsedId.data, file);
			if (result.ok) attached.push(result.attachment);
			else rejected.push({ name: file.name, reason: result.reason });
		}

		// Only bust caches if something actually landed.
		if (attached.length > 0) afterMutation("notes.write", { id: parsedId.data });

		return NextResponse.json(
			{ attached, rejected },
			// 207 would be more honest for a mixed batch, but every caller here
			// reads the two arrays anyway, and a non-2xx makes fetch callers
			// treat a partial success as total failure.
			{ status: attached.length === 0 ? 400 : 200 },
		);
	},
);

type IngestResult = { ok: true; attachment: Attachment } | { ok: false; reason: string };

async function ingest(
	sb: Parameters<typeof uploadAttachment>[0],
	noteId: string,
	file: File,
): Promise<IngestResult> {
	// Size is checked on the *incoming* bytes, so an oversized photo is refused
	// before sharp ever loads it into memory.
	if (file.size > ATTACHMENT_MAX_BYTES) {
		return { ok: false, reason: `Too large (max ${formatBytes(ATTACHMENT_MAX_BYTES)})` };
	}
	if (file.size === 0) {
		return { ok: false, reason: "Empty file" };
	}

	const contentType = normalizeContentType(file.type, file.name);
	if (!contentType) {
		return { ok: false, reason: "Unsupported file type" };
	}

	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!bytesMatchContentType(bytes, contentType)) {
		return { ok: false, reason: "File contents do not match its type" };
	}

	// Images shrink here; everything else passes through untouched. The size
	// recorded on the row is the post-downscale size, since that is what
	// actually occupies the quota.
	const processed =
		attachmentKind(contentType) === "image"
			? await downscaleImage(bytes, contentType)
			: { bytes, contentType };

	try {
		const attachment = await uploadAttachment(sb, noteId, {
			bytes: processed.bytes,
			name: file.name,
			contentType: processed.contentType,
		});
		return { ok: true, attachment };
	} catch (error) {
		// The detail belongs in the server log, not in the response body.
		console.error("attachment upload failed", { noteId, name: file.name, error });
		return { ok: false, reason: "Upload failed" };
	}
}
