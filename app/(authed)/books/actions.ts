"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { CreateBookSchema, FinishBookSchema, UpdateBookSchema } from "@/lib/schemas/book";
import {
	createBook,
	deleteBook,
	finishBook,
	setBookStatus,
	startReadingBook,
	updateBook,
} from "@/lib/services/books";
import { getAppTimezone } from "@/lib/services/settings";

function revalidateBookViews() {
	revalidatePath("/books");
}

function stringOrNull(raw: FormDataEntryValue | null): string | null {
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	return trimmed === "" ? null : trimmed;
}

function numberOrNull(raw: FormDataEntryValue | null): number | null {
	if (typeof raw !== "string" || raw.trim() === "") return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

export async function createBookAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateBookSchema.parse({
		title: formData.get("title"),
		author: stringOrNull(formData.get("author")),
		isbn: stringOrNull(formData.get("isbn")),
		format: formData.get("format") || null,
	});
	await createBook(sb, parsed);
	revalidateBookViews();
}

export async function deleteBookAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteBook(sb, z.uuid().parse(id));
	revalidateBookViews();
}

export async function startReadingBookAction(id: string) {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	await startReadingBook(sb, z.uuid().parse(id), tz);
	revalidateBookViews();
}

export async function markWantToReadAction(id: string) {
	const { sb } = await requireOwnerPage();
	await setBookStatus(sb, z.uuid().parse(id), "want_to_read");
	revalidateBookViews();
}

export async function abandonBookAction(id: string) {
	const { sb } = await requireOwnerPage();
	await setBookStatus(sb, z.uuid().parse(id), "abandoned");
	revalidateBookViews();
}

export async function finishBookAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = FinishBookSchema.parse({
		rating: numberOrNull(formData.get("rating")),
		my_summary: stringOrNull(formData.get("my_summary")),
	});
	const tz = await getAppTimezone(sb);
	await finishBook(sb, z.uuid().parse(id), tz, parsed);
	revalidateBookViews();
}

export async function updateBookAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const title = stringOrNull(formData.get("title"));
	const parsed = UpdateBookSchema.parse({
		title: title ?? undefined,
		author: stringOrNull(formData.get("author")),
		isbn: stringOrNull(formData.get("isbn")),
		format: formData.get("format") || null,
		my_summary: stringOrNull(formData.get("my_summary")),
	});
	await updateBook(sb, z.uuid().parse(id), parsed);
	revalidateBookViews();
}
