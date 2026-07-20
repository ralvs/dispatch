import Link from "next/link";
import type { QuoteRow } from "@/lib/services/quotes";
import { resetResurfacedAction, skipResurfacedQuoteAction } from "./actions";

/**
 * The daily rotating pull-quote. "Next →" skips today's pick; "Reset" undoes
 * the skips. When every quote has been skipped the card shows an exhausted
 * state with only Reset.
 */
export function ResurfacedQuote({
	quote,
	skips,
	hasQuotes,
}: {
	quote: QuoteRow | null;
	skips: number;
	hasQuotes: boolean;
}) {
	if (!hasQuotes) return null;

	return (
		<section
			className="mt-8 rounded-xl border border-line bg-surface px-5 py-6"
			aria-label="Resurfaced"
		>
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Resurfaced</h2>
			{quote ? (
				<>
					<blockquote className="mt-3 font-serif text-[19px] italic leading-snug text-ink">
						“{quote.text}”
					</blockquote>
					{(quote.source_author || quote.source_reference) && (
						<p className="mt-2 font-mono text-meta text-ink-3">
							{quote.source_author ?? quote.source_reference}
							{quote.source_author && quote.source_reference ? ` · ${quote.source_reference}` : ""}
						</p>
					)}
				</>
			) : (
				<p className="mt-3 font-serif italic text-ink-3">
					Every quote surfaced today has been skipped. Reset to start over.
				</p>
			)}
			<div className="mt-4 flex items-baseline gap-5 font-mono text-meta">
				{quote && (
					<>
						<Link href="/quotes" className="text-ink-3 hover:text-ink-2">
							Open in Quotes →
						</Link>
						<form action={skipResurfacedQuoteAction.bind(null, quote.id)} className="inline">
							<button type="submit" className="text-ink-3 hover:text-ink-2">
								Next →
							</button>
						</form>
					</>
				)}
				{skips > 0 && (
					<form action={resetResurfacedAction} className="inline">
						<button type="submit" className="text-ink-4 hover:text-ink-2">
							Reset
						</button>
					</form>
				)}
			</div>
		</section>
	);
}
