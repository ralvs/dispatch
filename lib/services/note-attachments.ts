import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	type AllowedContentType,
	mediaUrl,
	noteStoragePrefix,
	storageKey,
} from "@/lib/attachments";
import { nowUtc } from "@/lib/dates";
import type { Attachment } from "@/lib/schemas/note";
import { unwrap } from "@/lib/services/errors";
import { deleteObjects, listPrefix, putObject } from "@/lib/storage";

/*
 * Note attachments (docs/adr/0052). Two stores are in play — bytes in R2,
 * metadata in Postgres — and this module is the only place that keeps them in
 * step. Bytes always move through the storage port, never a provider client.
 *
 * `sb` first (iron rule #3): the Postgres half still runs RLS-scoped from
 * pages and actions.
 */

export type UploadInput = {
	bytes: Uint8Array;
	/** Original client filename. Display only — it never enters the storage key. */
	name: string;
	contentType: AllowedContentType;
};

/**
 * Write order is bytes first, row second, because the failure modes are not
 * symmetrical: an object with no row is invisible garbage we can sweep, while
 * a row pointing at a missing object is a broken thumbnail on the page. If the
 * row write fails we delete the object we just wrote, so neither state sticks.
 */
export async function uploadAttachment(
	sb: SupabaseClient,
	noteId: string,
	input: UploadInput,
): Promise<Attachment> {
	const key = storageKey(noteId, input.contentType);
	await putObject(key, input.bytes, input.contentType);

	const attachment: Attachment = {
		url: mediaUrl(key),
		storage_path: key,
		name: input.name,
		content_type: input.contentType,
		size_bytes: input.bytes.byteLength,
		uploaded_at: nowUtc(),
	};

	try {
		unwrap(
			await sb.rpc("note_attachment_add", {
				p_note_id: noteId,
				p_item: attachment,
			}),
		);
	} catch (error) {
		// Don't leave bytes nothing will ever reference.
		await deleteObjects([key]).catch(() => {});
		throw error;
	}

	return attachment;
}

/**
 * Row first, bytes second — the mirror of upload, for the same reason. Once
 * the row is gone the file is off the page, and a failed object delete leaks
 * bytes rather than leaving a dead thumbnail.
 */
export async function removeAttachment(
	sb: SupabaseClient,
	noteId: string,
	storagePath: string,
): Promise<void> {
	unwrap(
		await sb.rpc("note_attachment_remove", {
			p_note_id: noteId,
			p_storage_path: storagePath,
		}),
	);
	await deleteObjects([storagePath]);
}

/**
 * Sweep every object under a note's prefix. Called when the note itself is
 * deleted, where the row is already going away — so this works off the prefix
 * rather than the attachments array and catches orphans a failed write left
 * behind.
 */
export async function removeAllForNote(noteId: string): Promise<void> {
	const keys = await listPrefix(noteStoragePrefix(noteId));
	if (keys.length === 0) return;
	await deleteObjects(keys);
}
