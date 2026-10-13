import { NextResponse } from "next/server";
import { z } from "zod";
import type { AttachFilesReply } from "@/lib/attachments";
import { ownerRoute } from "@/lib/auth";
import { isR2Configured } from "@/lib/env";
import { afterMutation } from "@/lib/invalidate";
import { attachNoteFiles } from "@/lib/services/note-files";

/*
 * The write side of note attachments (docs/adr/0052). This route only
 * translates HTTP; the intake rule, the batch and the reply live in
 * lib/services/note-files.ts (docs/adr/0088).
 *
 * A route rather than a server action because this carries binary and wants to
 * answer with the created rows; removal is a server action, matching the link
 * rail next to it. Owner-checked first line (iron rule #2), and the note id is
 * validated before anything touches storage.
 *
 * When something landed, the answer also carries `write`: the note row read
 * back, for the client's entity store (#27). A route handler cannot call
 * updateTag, so the client confirms from this instead.
 */

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

		const result = await attachNoteFiles(sb, parsedId.data, files);
		if (!result.ok) {
			return NextResponse.json({ error: "Note not found" }, { status: 404 });
		}
		const { reply } = result;

		// Only bust caches if something actually landed.
		if (reply.attached.length) afterMutation("notes.write");

		return NextResponse.json(
			reply satisfies AttachFilesReply,
			// 207 would be more honest for a mixed batch, but every caller here
			// reads the two arrays anyway, and a non-2xx makes fetch callers
			// treat a partial success as total failure.
			{ status: reply.attached.length === 0 ? 400 : 200 },
		);
	},
);
