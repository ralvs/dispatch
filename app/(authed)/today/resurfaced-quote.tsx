"use client";

import Link from "next/link";
import { useTransition } from "react";
import { runAction } from "@/lib/client/toast";
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
	const [pending, startTransition] = useTransition();

	if (!hasQuotes) return null;

	return (
		<section
			className="elevation-card mt-14 rounded-card border border-line bg-surface px-5 py-6"
			aria-label="Resurfaced"
		>
			<h2 className="label">Resurfaced</h2>
			{quote ? (
				<>
					<blockquote className="mt-3 font-serif text-lg italic leading-snug text-ink">
						“{quote.text}”
					</blockquote>
					{(quote.source_author || quote.source_reference) && (
						<p className="mt-2 text-meta text-ink-3">
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
			<div className="mt-4 flex items-baseline gap-5 text-meta">
				{quote && (
					<>
						<Link href="/quotes" className="text-ink-3 hover:text-ink-2">
							Open in Quotes →
						</Link>
						<button
							type="button"
							disabled={pending}
							onClick={() =>
								startTransition(async () => {
									await runAction(
										() => skipResurfacedQuoteAction(quote.id),
										"Couldn't skip quote.",
									);
								})
							}
							className="text-ink-3 hover:text-ink-2 active:translate-y-px disabled:opacity-50"
						>
							Next →
						</button>
					</>
				)}
				{skips > 0 && (
					<button
						type="button"
						disabled={pending}
						onClick={() =>
							startTransition(async () => {
								await runAction(() => resetResurfacedAction(), "Couldn't reset skips.");
							})
						}
						className="text-ink-4 hover:text-ink-2 active:translate-y-px disabled:opacity-50"
					>
						Reset
					</button>
				)}
			</div>
		</section>
	);
}
