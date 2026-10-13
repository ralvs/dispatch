import "server-only";
import {
	type AllowedContentType,
	ATTACHMENT_MAX_BYTES,
	type AttachFilesReply,
	attachmentKind,
	bytesMatchContentType,
	type FileRejection,
	formatBytes,
	normalizeContentType,
} from "@/lib/attachments";
import { downscaleImage } from "@/lib/images";
import type { Attachment } from "@/lib/schemas/note";
import { uploadAttachment, type WithStorage } from "@/lib/services/note-attachments";
import { getNote } from "@/lib/services/notes";
import { written } from "@/lib/services/written";
import type { SupabaseClient } from "@/lib/supabase/types";

/*
 * Taking in a note file (docs/adr/0088): the intake rule, the batch, and the
 * reply. The attachments route only translates HTTP around this.
 *
 * Its own module, not part of note-attachments, because it reads the note back
 * (getNote, written) and notes already imports note-attachments: folding it in
 * would close the cycle notes → note-attachments → notes.
 */

/** A file that passed intake, ready for storage. `name` is the client's original. */
export type VettedFile = { name: string; bytes: Uint8Array; contentType: AllowedContentType };

/**
 * The intake rule. Size, empty, type, sniff, downscale — in that order, with
 * no storage and no database, so it is unit-tested against real bytes.
 */
export async function vetNoteFile(
	file: File,
): Promise<{ ok: true; file: VettedFile } | { ok: false; rejection: FileRejection }> {
	const reject = (reason: string) => ({
		ok: false as const,
		rejection: { name: file.name, reason },
	});

	// Size is checked on the *incoming* bytes, so an oversized photo is refused
	// before sharp ever loads it into memory.
	if (file.size > ATTACHMENT_MAX_BYTES) {
		return reject(`Too large (max ${formatBytes(ATTACHMENT_MAX_BYTES)})`);
	}
	if (file.size === 0) return reject("Empty file");

	const contentType = normalizeContentType(file.type, file.name);
	if (!contentType) return reject("Unsupported file type");

	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!bytesMatchContentType(bytes, contentType)) {
		return reject("File contents do not match its type");
	}

	// Images shrink here; everything else passes through untouched. The size
	// recorded on the row is the post-downscale size, since that is what
	// actually occupies the quota.
	const processed =
		attachmentKind(contentType) === "image"
			? await downscaleImage(bytes, contentType)
			: { bytes, contentType };

	return {
		ok: true,
		file: { name: file.name, bytes: processed.bytes, contentType: processed.contentType },
	};
}

export type AttachNoteFilesResult =
	| { ok: true; reply: AttachFilesReply }
	| { ok: false; error: "note-not-found" };

/**
 * Attach a batch of files to one note, one at a time in the order given.
 *
 * Partial success is a real outcome here: dropping five files where one is a
 * .zip should attach four and say which one it refused, not fail the batch.
 */
export async function attachNoteFiles(
	sb: SupabaseClient,
	noteId: string,
	files: File[],
	opts?: WithStorage,
): Promise<AttachNoteFilesResult> {
	// The attach RPC updates no row for an unknown id and says nothing, so
	// without this the bytes would land and be reported attached to nothing.
	if (!(await getNote(sb, noteId))) return { ok: false, error: "note-not-found" };

	const attached: Attachment[] = [];
	const rejected: FileRejection[] = [];

	for (const file of files) {
		const vetted = await vetNoteFile(file);
		if (!vetted.ok) {
			rejected.push(vetted.rejection);
			continue;
		}
		try {
			attached.push(await uploadAttachment(sb, noteId, vetted.file, opts));
		} catch (error) {
			// The detail belongs in the server log, not in the response body.
			console.error("attachment upload failed", { noteId, name: file.name, error });
			rejected.push({ name: file.name, reason: "Upload failed" });
		}
	}

	// The row read back for the client's entity store (#27), only when
	// something landed.
	const write = attached.length ? await written(sb, "note", noteId) : null;
	return { ok: true, reply: { attached, rejected, write } };
}
