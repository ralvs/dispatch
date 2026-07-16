import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { JournalEntrySourceSchema } from "@/lib/schemas/journal";
import { unwrap } from "@/lib/services/errors";

// ─── Journal entries ────────────────────────────────────────────────────

const JOURNAL_ENTRY_SELECT =
	"id, book_id, entry_date, image_path, transcription_text, source, tags, extracted_facts, attachments, resurface_weight, created_at";

export type JournalEntryRow = {
	id: string;
	book_id: string | null;
	entry_date: string;
	image_path: string | null;
	transcription_text: string | null;
	source: z.infer<typeof JournalEntrySourceSchema>;
	tags: string[];
	extracted_facts: Record<string, unknown>;
	attachments: unknown[];
	resurface_weight: number;
	created_at: string;
};

export type CreateJournalEntryInput = {
	book_id?: string | null;
	entry_date: string;
	transcription_text: string;
	source?: z.infer<typeof JournalEntrySourceSchema>;
	tags?: string[];
};

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
	return (data ?? []) as JournalEntryRow[];
}

export async function getEntry(sb: SupabaseClient, id: string): Promise<JournalEntryRow | null> {
	const data = unwrap(
		await sb.from("journal_entries").select(JOURNAL_ENTRY_SELECT).eq("id", id).maybeSingle(),
	);
	return (data as JournalEntryRow | null) ?? null;
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
	return data as JournalEntryRow;
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

const JOURNAL_BOOK_SELECT = "id, book_number, start_date, end_date, notes, created_at";

export type JournalBookRow = {
	id: string;
	book_number: number;
	start_date: string | null;
	end_date: string | null;
	notes: string | null;
	created_at: string;
};

export async function listBooks(sb: SupabaseClient): Promise<JournalBookRow[]> {
	const data = unwrap(
		await sb
			.from("journal_books")
			.select(JOURNAL_BOOK_SELECT)
			.order("book_number", { ascending: false }),
	);
	return (data ?? []) as JournalBookRow[];
}
