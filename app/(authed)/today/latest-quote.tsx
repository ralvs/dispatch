import Link from "next/link";
import { Card } from "@/components/ui";
import type { QuoteRow } from "@/lib/services/quotes";

/** The newest quote in the library — hidden by the page when it matches Resurfaced. */
export function LatestQuote({ quote }: { quote: QuoteRow }) {
	return (
		<section className="mt-8" aria-label="Latest quote">
			<Card padding="comfortable">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Latest quote
				</h2>
				<blockquote className="mt-3 font-serif text-lg italic leading-snug text-ink">
					“{quote.text}”
				</blockquote>
				{(quote.source_author || quote.source_reference) && (
					<p className="mt-2 font-mono text-meta text-ink-3">
						{quote.source_author ?? quote.source_reference}
						{quote.source_author && quote.source_reference ? ` · ${quote.source_reference}` : ""}
					</p>
				)}
				<p className="mt-4 font-mono text-meta">
					<Link href="/quotes" className="text-ink-3 hover:text-ink-2">
						Open quote →
					</Link>
				</p>
			</Card>
		</section>
	);
}
