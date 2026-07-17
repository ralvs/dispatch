"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { CreateQuoteAnnotationSchema, CreateQuoteSchema } from "@/lib/schemas/quote";
import {
	createAnnotation,
	createQuote,
	deleteQuote,
	listAnnotations,
	type QuoteAnnotationRow,
} from "@/lib/services/quotes";

function revalidateQuoteViews() {
	revalidatePath("/quotes");
}

function tagsFromForm(raw: FormDataEntryValue | null): string[] | undefined {
	if (typeof raw !== "string") return undefined;
	const tags = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	return tags.length > 0 ? tags : [];
}

export async function createQuoteAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateQuoteSchema, formData, {
		overrides: { tags: tagsFromForm(formData.get("tags")), added_via: "manual" },
	});
	await createQuote(sb, parsed);
	revalidateQuoteViews();
}

export async function deleteQuoteAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteQuote(sb, z.uuid().parse(id));
	revalidateQuoteViews();
}

export async function createAnnotationAction(quoteId: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateQuoteAnnotationSchema, formData, {
		overrides: { quote_id: z.uuid().parse(quoteId) },
	});
	await createAnnotation(sb, parsed);
	revalidateQuoteViews();
}

export async function listAnnotationsAction(quoteId: string): Promise<QuoteAnnotationRow[]> {
	const { sb } = await requireOwnerPage();
	return listAnnotations(sb, z.uuid().parse(quoteId));
}
