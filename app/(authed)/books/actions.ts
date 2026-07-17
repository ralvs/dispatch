"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
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

export async function createBookAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateBookSchema, formData);
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
	const parsed = decodeForm(FinishBookSchema, formData, { spec: { rating: "number" } });
	const tz = await getAppTimezone(sb);
	await finishBook(sb, z.uuid().parse(id), tz, parsed);
	revalidateBookViews();
}

export async function updateBookAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(UpdateBookSchema, formData);
	await updateBook(sb, z.uuid().parse(id), parsed);
	revalidateBookViews();
}
