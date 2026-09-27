import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedQuotes } from "@/lib/cache/quotes";
import { QuoteCreateButton } from "./quote-form";
import { QuoteRowItem } from "./quote-row";

async function QuotesBody() {
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

function QuotesFallback() {
	return <PageSkeleton title="Quotes" action={<CreateTrigger label="New quote" disabled />} />;
}

// The data streams in behind the page's own boundary, so the route keeps no
// loading.tsx and its static parts come out of the prerendered shell (#21).
export default function QuotesPage() {
	return (
		<Suspense fallback={<QuotesFallback />}>
			<QuotesBody />
		</Suspense>
	);
}
