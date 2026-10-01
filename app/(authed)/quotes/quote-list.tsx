"use client";

import { EmptyState, PageHeader } from "@/components/ui";
import type { QuoteRow } from "@/lib/schemas/quote";
import { useView, viewKey } from "@/lib/store";
import { QuoteCreateButton } from "./quote-form";
import { QuoteRowItem } from "./quote-row";

const NO_QUOTES: QuoteRow[] = [];

/**
 * /quotes from the entity store (#30). The header's count and the list read
 * the same rows, so a create or a delete moves both at once, with no page
 * render.
 */
export function QuoteList() {
	const quotes = useView(viewKey.quotes()) ?? NO_QUOTES;

	return (
		<div>
			<PageHeader
				title="Quotes"
				measure={[{ count: quotes.length, label: "saved" }]}
				action={<QuoteCreateButton />}
			/>

			{quotes.length === 0 ? (
				<EmptyState>Nothing saved yet. Capture something you read or heard.</EmptyState>
			) : (
				// Single ungrouped list — header measure is the count.
				<ul>
					{quotes.map((q) => (
						<QuoteRowItem key={q.id} quote={q} />
					))}
				</ul>
			)}
		</div>
	);
}
