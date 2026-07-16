import { requireOwnerPage } from "@/lib/auth";
import { listQuotes } from "@/lib/services/quotes";
import { QuoteForm } from "./quote-form";
import { QuoteRowItem } from "./quote-row";

export default async function QuotesPage() {
	const { sb } = await requireOwnerPage();
	const quotes = await listQuotes(sb);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Quotes</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Words worth keeping</h1>
			</header>

			<section className="mt-6">
				<QuoteForm />
			</section>

			<section className="mt-6" aria-label="Quotes">
				{quotes.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						Nothing saved yet. Capture something you read or heard.
					</p>
				) : (
					<ul className="mt-2">
						{quotes.map((q) => (
							<QuoteRowItem key={q.id} quote={q} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
