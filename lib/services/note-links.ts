import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTE_LINK_SELECT, type NoteLinkRow } from "@/lib/schemas/note-link";
import { ServiceError, unwrap } from "@/lib/services/errors";

export type { NoteLinkRow };

/** All links for a note (both directions of authorship: this note is the source), oldest first. */
export async function listLinksForNote(sb: SupabaseClient, noteId: string): Promise<NoteLinkRow[]> {
	const data = unwrap(
		await sb
			.from("note_links")
			.select(NOTE_LINK_SELECT)
			.eq("note_id", noteId)
			.order("created_at", { ascending: true }),
	);
	return (data ?? []) as unknown as NoteLinkRow[];
}

export type Backlink = {
	id: string;
	note_id: string;
	title: string | null;
	body: string;
	created_at: string;
};

/** Notes that link to `noteId`, joined with the source note for title/body. */
export async function listBacklinks(sb: SupabaseClient, noteId: string): Promise<Backlink[]> {
	const data = unwrap(
		await sb
			.from("note_links")
			.select("id, note_id, created_at, note:notes!note_links_note_id_fkey(id,title,body)")
			.eq("target_type", "note")
			.eq("target_note_id", noteId)
			.order("created_at", { ascending: true }),
	);
	return (
		(data ?? []) as unknown as Array<{
			id: string;
			note_id: string;
			created_at: string;
			note: { id: string; title: string | null; body: string } | null;
		}>
	)
		.filter((row) => row.note !== null)
		.map((row) => ({
			id: row.id,
			note_id: row.note_id,
			title: row.note?.title ?? null,
			body: row.note?.body ?? "",
			created_at: row.created_at,
		}));
}

/**
 * Reconciles the note's `kind='wikilink'` edges with the set of note ids
 * parsed out of its body on save. Never touches `kind='manual'` rows.
 */
export async function syncWikilinks(
	sb: SupabaseClient,
	noteId: string,
	targetIds: string[],
): Promise<void> {
	const candidateIds = [...new Set(targetIds)].filter((id) => id !== noteId);

	let validIds: string[] = [];
	if (candidateIds.length > 0) {
		const found = unwrap(
			await sb.from("notes").select("id").in("id", candidateIds),
		) as unknown as Array<{ id: string }>;
		validIds = found.map((row) => row.id);
	}

	const existing = unwrap(
		await sb
			.from("note_links")
			.select("id, target_note_id")
			.eq("note_id", noteId)
			.eq("kind", "wikilink"),
	) as unknown as Array<{ id: string; target_note_id: string | null }>;

	const validSet = new Set(validIds);
	const existingByTarget = new Map(existing.map((row) => [row.target_note_id, row.id]));

	const staleIds = existing
		.filter((row) => row.target_note_id === null || !validSet.has(row.target_note_id))
		.map((row) => row.id);
	if (staleIds.length > 0) {
		unwrap(await sb.from("note_links").delete().in("id", staleIds));
	}

	const missingTargets = validIds.filter((id) => !existingByTarget.has(id));
	if (missingTargets.length > 0) {
		// Two overlapping autosaves can compute the same missing targets; the
		// unique (note_id, target_type, target_note_id, kind) edge index makes
		// this insert idempotent-in-effect, so a 23505 here means the desired
		// row already exists and is safe to swallow.
		try {
			unwrap(
				await sb.from("note_links").insert(
					missingTargets.map((target_note_id) => ({
						note_id: noteId,
						target_type: "note" as const,
						target_note_id,
						kind: "wikilink" as const,
					})),
				),
			);
		} catch (err) {
			if (!(err instanceof ServiceError && err.code === "23505")) {
				throw err;
			}
		}
	}
}

export type CreateManualLinkInput = {
	note_id: string;
	target_type: "note" | "task" | "event";
	target_id: string;
};

/** Idempotent: if the edge already exists (unique violation), returns the existing row. */
export async function createManualLink(
	sb: SupabaseClient,
	input: CreateManualLinkInput,
): Promise<NoteLinkRow> {
	const row = {
		note_id: input.note_id,
		target_type: input.target_type,
		kind: "manual" as const,
		target_note_id: input.target_type === "note" ? input.target_id : null,
		target_task_id: input.target_type === "task" ? input.target_id : null,
		target_event_id: input.target_type === "event" ? input.target_id : null,
	};

	try {
		const data = unwrap(await sb.from("note_links").insert(row).select(NOTE_LINK_SELECT).single());
		return data as unknown as NoteLinkRow;
	} catch (err) {
		if (err instanceof ServiceError && err.code === "23505") {
			const targetColumn =
				input.target_type === "note"
					? "target_note_id"
					: input.target_type === "task"
						? "target_task_id"
						: "target_event_id";
			const existing = unwrap(
				await sb
					.from("note_links")
					.select(NOTE_LINK_SELECT)
					.eq("note_id", input.note_id)
					.eq("target_type", input.target_type)
					.eq(targetColumn, input.target_id)
					.eq("kind", "manual")
					.single(),
			);
			return existing as unknown as NoteLinkRow;
		}
		throw err;
	}
}

export async function deleteLink(sb: SupabaseClient, linkId: string): Promise<void> {
	unwrap(await sb.from("note_links").delete().eq("id", linkId));
}

/**
 * For a batch of task/event ids, the first (oldest-created) note linked to
 * each — used to render a "linked note" affordance on task/event views.
 */
export async function listNoteIdsForTargets(
	sb: SupabaseClient,
	targetType: "task" | "event",
	targetIds: string[],
): Promise<Map<string, string>> {
	if (targetIds.length === 0) return new Map();

	const targetColumn = targetType === "task" ? "target_task_id" : "target_event_id";
	const data = unwrap(
		await sb
			.from("note_links")
			.select(`note_id, ${targetColumn}`)
			.eq("target_type", targetType)
			.in(targetColumn, targetIds)
			.order("created_at", { ascending: true }),
	) as unknown as Array<Record<string, string>>;

	const result = new Map<string, string>();
	for (const row of data) {
		const targetId = row[targetColumn];
		if (targetId && !result.has(targetId)) {
			result.set(targetId, row.note_id);
		}
	}
	return result;
}
