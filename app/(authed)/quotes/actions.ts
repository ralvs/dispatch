"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateQuoteAnnotationSchema, CreateQuoteSchema } from "@/lib/schemas/quote";
import {
	createAnnotation,
	createQuote,
	deleteQuote,
	listAnnotations,
	type QuoteAnnotationRow,
	type QuoteRow,
} from "@/lib/services/quotes";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// The quote actions return what they wrote (#30), so the client's entity store
// confirms its optimistic intent from it instead of waiting on a page render.

type QuoteWrite = StoreWrite<QuoteRow>;

function revalidateQuoteViews() {
	afterMutation("quotes.write");
}

function tagsFromForm(raw: FormDataEntryValue | null): string[] | undefined {
	if (typeof raw !== "string") return undefined;
	const tags = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	return tags.length > 0 ? tags : [];
}

export async function createQuoteAction(formData: FormData): Promise<ActionResult<QuoteWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const parsed = decodeForm(CreateQuoteSchema, formData, {
			overrides: { tags: tagsFromForm(formData.get("tags")), added_via: "manual" },
		});
		const quote = await createQuote(sb, parsed);
		revalidateQuoteViews();
		return stampWrite([quote]);
	});
}

export async function deleteQuoteAction(id: string): Promise<ActionResult<QuoteWrite>> {
	const { sb } = await requireOwnerPage();
	const quoteId = z.uuid().parse(id);
	await deleteQuote(sb, quoteId);
	revalidateQuoteViews();
	return { ok: true, data: stampWrite([], [quoteId]) };
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
