import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PEOPLE_SELECT, type PersonRow } from "@/lib/schemas/person";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// @mention People (docs/adr/0030 Decision 4). syncMentions mirrors
// syncWikilinks' full-reconcile shape (lib/services/note-links.ts): validate
// person ids exist, delete stale rows, insert missing ones, swallow the
// duplicate-key error. Because it reconciles rather than appends, any
// re-save self-heals a stale link. Never touches an existing row's
// matched_name — only inserts and deletes.
// ─────────────────────────────────────────────────────────────────────────

export type MentionSource = { type: "task" | "note"; id: string };

function sourceColumn(type: "task" | "note"): "task_id" | "note_id" {
	return type === "task" ? "task_id" : "note_id";
}

/**
 * Reconciles a task's or note's mention rows with the set of person matches
 * found in its current text. Callers wrap this in try/catch on the capture
 * path (iron rule #4) — a mention that fails to sync must never fail a
 * capture.
 */
export async function syncMentions(
	sb: SupabaseClient,
	source: MentionSource,
	matches: { personId: string; name: string }[],
): Promise<void> {
	const column = sourceColumn(source.type);

	const candidateIds = [...new Set(matches.map((m) => m.personId))];
	let validIds = new Set<string>();
	if (candidateIds.length > 0) {
		const found = unwrap(
			await sb.from("people").select("id").in("id", candidateIds),
		) as unknown as Array<{ id: string }>;
		validIds = new Set(found.map((row) => row.id));
	}

	// First appearance wins if the same person is matched more than once.
	const desired = new Map<string, string>();
	for (const match of matches) {
		if (!validIds.has(match.personId)) continue;
		if (!desired.has(match.personId)) desired.set(match.personId, match.name);
	}

	const existing = unwrap(
		await sb.from("mentions").select("id, person_id").eq(column, source.id),
	) as unknown as Array<{ id: string; person_id: string }>;

	const existingByPerson = new Map(existing.map((row) => [row.person_id, row.id]));

	const staleIds = existing.filter((row) => !desired.has(row.person_id)).map((row) => row.id);
	if (staleIds.length > 0) {
		unwrap(await sb.from("mentions").delete().in("id", staleIds));
	}

	const missing = [...desired.entries()].filter(([personId]) => !existingByPerson.has(personId));
	if (missing.length > 0) {
		// Two overlapping saves can compute the same missing set; the partial
		// unique index per source column makes this insert idempotent-in-effect,
		// so a 23505 here means the desired row already exists and is safe to
		// swallow.
		try {
			unwrap(
				await sb.from("mentions").insert(
					missing.map(([person_id, matched_name]) => ({
						person_id,
						[column]: source.id,
						source_type: source.type,
						matched_name,
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

/** For a batch of task/note ids, the people mentioned in each. */
export async function listMentionsForSources(
	sb: SupabaseClient,
	type: "task" | "note",
	ids: string[],
): Promise<Map<string, PersonRow[]>> {
	const result = new Map<string, PersonRow[]>();
	if (ids.length === 0) return result;

	const column = sourceColumn(type);
	const data = unwrap(
		await sb.from("mentions").select(`${column}, person:people(${PEOPLE_SELECT})`).in(column, ids),
	) as unknown as Array<Record<string, unknown>>;

	for (const row of data) {
		const sourceId = row[column] as string | null;
		const person = row.person as PersonRow | null;
		if (!sourceId || !person) continue;
		const list = result.get(sourceId);
		if (list) {
			list.push(person);
		} else {
			result.set(sourceId, [person]);
		}
	}
	return result;
}

/** The tasks and notes mentioning a person — the "Mentioned in" panel on /people/[id]. */
export async function listMentionsForPerson(
	sb: SupabaseClient,
	personId: string,
): Promise<{ tasks: unknown[]; notes: unknown[] }> {
	const data = unwrap(
		await sb
			.from("mentions")
			.select("source_type, task:tasks(*), note:notes(*)")
			.eq("person_id", personId)
			.order("created_at", { ascending: false }),
	) as unknown as Array<{ source_type: "task" | "note"; task: unknown; note: unknown }>;

	const tasks = data.filter((row) => row.source_type === "task" && row.task).map((row) => row.task);
	const notes = data.filter((row) => row.source_type === "note" && row.note).map((row) => row.note);
	return { tasks, notes };
}
