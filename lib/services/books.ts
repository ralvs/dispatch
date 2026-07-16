import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { todayInTz } from "@/lib/dates";
import type { BookFormatSchema, BookStatusSchema } from "@/lib/schemas/book";
import { unwrap } from "@/lib/services/errors";

const BOOK_SELECT =
	"id, title, author, isbn, cover_image_url, status, format, started_at, finished_at, rating, my_summary, created_at";

export type BookRow = {
	id: string;
	title: string;
	author: string | null;
	isbn: string | null;
	cover_image_url: string | null;
	status: z.infer<typeof BookStatusSchema>;
	format: z.infer<typeof BookFormatSchema> | null;
	started_at: string | null;
	finished_at: string | null;
	rating: number | null;
	my_summary: string | null;
	created_at: string;
};

export type CreateBookInput = {
	title: string;
	author?: string | null;
	isbn?: string | null;
	cover_image_url?: string | null;
	status?: z.infer<typeof BookStatusSchema>;
	format?: z.infer<typeof BookFormatSchema> | null;
};

export type UpdateBookInput = Partial<CreateBookInput> & {
	started_at?: string | null;
	finished_at?: string | null;
	rating?: number | null;
	my_summary?: string | null;
};

/** All books, newest-first within status. Group in the UI by the order returned. */
export async function listBooks(
	sb: SupabaseClient,
	filters: { status?: z.infer<typeof BookStatusSchema> } = {},
): Promise<BookRow[]> {
	let q = sb.from("books").select(BOOK_SELECT).order("created_at", { ascending: false });
	if (filters.status) q = q.eq("status", filters.status);
	const data = unwrap(await q);
	return (data ?? []) as BookRow[];
}

export async function getBook(sb: SupabaseClient, id: string): Promise<BookRow | null> {
	const data = unwrap(await sb.from("books").select(BOOK_SELECT).eq("id", id).maybeSingle());
	return (data as BookRow | null) ?? null;
}

export async function createBook(sb: SupabaseClient, input: CreateBookInput): Promise<BookRow> {
	const data = unwrap(await sb.from("books").insert(input).select(BOOK_SELECT).single());
	return data as BookRow;
}

export async function updateBook(
	sb: SupabaseClient,
	id: string,
	patch: UpdateBookInput,
): Promise<void> {
	unwrap(await sb.from("books").update(patch).eq("id", id));
}

export async function deleteBook(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("books").delete().eq("id", id));
}

/**
 * Move a book to `reading` — stamps `started_at` with today's date in the
 * app timezone (idempotent: overwrites any prior started_at).
 */
export async function startReadingBook(sb: SupabaseClient, id: string, tz: string): Promise<void> {
	unwrap(
		await sb
			.from("books")
			.update({ status: "reading", started_at: todayInTz(tz) })
			.eq("id", id),
	);
}

/**
 * Move a book to `finished` — stamps `finished_at` with today's date in the
 * app timezone and optionally records a rating + closing summary.
 */
export async function finishBook(
	sb: SupabaseClient,
	id: string,
	tz: string,
	extra: { rating?: number | null; my_summary?: string | null } = {},
): Promise<void> {
	unwrap(
		await sb
			.from("books")
			.update({
				status: "finished",
				finished_at: todayInTz(tz),
				...extra,
			})
			.eq("id", id),
	);
}

/** Move a book to `abandoned` or back to `want_to_read` — no date side effects. */
export async function setBookStatus(
	sb: SupabaseClient,
	id: string,
	status: z.infer<typeof BookStatusSchema>,
): Promise<void> {
	unwrap(await sb.from("books").update({ status }).eq("id", id));
}
