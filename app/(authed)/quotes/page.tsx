import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listQuotes } from "@/lib/services/quotes";
import { QuoteCreateButton } from "./quote-form";
import { QuoteRowItem } from "./quote-row";

export default async function QuotesPage() {
	const { sb } = await requireOwnerPage();
	const quotes = await listQuotes(sb);

	return (
		<div>
			<PageHeader
				title="Quotes"
				measure={[{ count: quotes.length, label: "saved" }]}
				action={<QuoteCreateButton />}
			/>

			<section aria-label="Quotes">
				{quotes.length === 0 ? (
					<EmptyState>Nothing saved yet. Capture something you read or heard.</EmptyState>
				) : (
					<ul>
						{quotes.map((q) => (
							<QuoteRowItem key={q.id} quote={q} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
