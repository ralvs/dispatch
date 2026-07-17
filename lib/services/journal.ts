import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
	type CreateJournalEntrySchema,
	JOURNAL_BOOK_SELECT,
	JOURNAL_ENTRY_SELECT,
	type JournalBookRow,
	type JournalEntryRow,
} from "@/lib/schemas/journal";
import { unwrap } from "@/lib/services/errors";

export type { JournalBookRow, JournalEntryRow };

// ─── Journal entries ────────────────────────────────────────────────────

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>;

export async function listEntries(
	sb: SupabaseClient,
	filters: { tag?: string; bookId?: string } = {},
): Promise<JournalEntryRow[]> {
	let q = sb
		.from("journal_entries")
		.select(JOURNAL_ENTRY_SELECT)
		.order("entry_date", { ascending: false })
		.order("created_at", { ascending: false });
	if (filters.tag) q = q.contains("tags", [filters.tag]);
	if (filters.bookId) q = q.eq("book_id", filters.bookId);
	const data = unwrap(await q);
	return (data ?? []) as unknown as JournalEntryRow[];
}

export async function getEntry(sb: SupabaseClient, id: string): Promise<JournalEntryRow | null> {
	const data = unwrap(
		await sb.from("journal_entries").select(JOURNAL_ENTRY_SELECT).eq("id", id).maybeSingle(),
	);
	return (data as unknown as JournalEntryRow | null) ?? null;
}

/** Create a text journal entry. Text is stored verbatim in whatever language it arrived in. */
export async function createEntry(
	sb: SupabaseClient,
	input: CreateJournalEntryInput,
): Promise<JournalEntryRow> {
	const data = unwrap(
		await sb
			.from("journal_entries")
			.insert({
				...input,
				source: input.source ?? "typed",
			})
			.select(JOURNAL_ENTRY_SELECT)
			.single(),
	);
	return data as unknown as JournalEntryRow;
}

export async function updateEntry(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreateJournalEntryInput>,
): Promise<void> {
	unwrap(await sb.from("journal_entries").update(patch).eq("id", id));
}

export async function deleteEntry(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("journal_entries").delete().eq("id", id));
}

// ─── Journal books (read-only in v1) ───────────────────────────────────

export async function listBooks(sb: SupabaseClient): Promise<JournalBookRow[]> {
	const data = unwrap(
		await sb
			.from("journal_books")
			.select(JOURNAL_BOOK_SELECT)
			.order("book_number", { ascending: false }),
	);
	return (data ?? []) as unknown as JournalBookRow[];
}
