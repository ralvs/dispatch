import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedQuotes } from "@/lib/cache/quotes";
import { QuoteCreateButton } from "./quote-form";
import { QuoteRowItem } from "./quote-row";

export default async function QuotesPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const quotes = await getCachedQuotes();

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
