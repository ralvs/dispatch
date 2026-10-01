"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/client/toast";
import type { QuoteRow } from "@/lib/services/quotes";
import { resetResurfacedAction, skipResurfacedQuoteAction } from "./actions";

type Shown = { quote: QuoteRow | null; skips: number; hasQuotes: boolean };

/**
 * The daily rotating pull-quote, at the foot of the left column. "Next →" skips
 * today's pick; "Reset" undoes the skips. When every quote has been skipped the
 * card shows an exhausted state with only Reset.
 *
 * It is the one italic on the page and the only card that is not a list — it is
 * the day's punctuation, not part of the work, which is why it sits last rather
 * than competing with the timeline for the top of the column.
 *
 * "Next →" and "Reset" answer with the card's new state, which the card shows
 * at once (#30). A later server render of Today replaces it.
 */
export function ResurfacedQuote(props: Shown) {
	const [pending, startTransition] = useTransition();
	const [fromServer, setFromServer] = useState(props);
	const [shown, setShown] = useState(props);
	// A new server render wins over the last action's answer: adjusted during
	// render, so the stale card never paints.
	if (
		fromServer.quote?.id !== props.quote?.id ||
		fromServer.skips !== props.skips ||
		fromServer.hasQuotes !== props.hasQuotes
	) {
		setFromServer(props);
		setShown(props);
	}
	const { quote, skips, hasQuotes } = shown;

	function act(action: () => Promise<ActionResult<Shown>>, message: string) {
		startTransition(async () => {
			await runAction(async () => {
				const result = await action();
				if (!result.ok) throw new Error(result.formError ?? message);
				setShown(result.data);
			}, message);
		});
	}

	if (!hasQuotes) return null;

	const attribution = [quote?.source_author, quote?.source_reference].filter(Boolean).join(" · ");

	return (
		<section className="t-sec-quote" aria-label="Resurfaced">
			<Card padding="none" className="px-6 py-5 lg:px-6 lg:py-[22px]">
				<h2 className="m-0 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Resurfaced
				</h2>
				{quote ? (
					<>
						<blockquote className="mt-3 text-lg italic leading-[1.5] tracking-[-0.01em] text-ink lg:leading-[1.55]">
							“{quote.text}”
						</blockquote>
						{attribution && <p className="mt-2.5 font-mono text-meta text-ink-3">{attribution}</p>}
					</>
				) : (
					<p className="mt-3 text-base italic text-ink-3">
						Every quote surfaced today has been skipped. Reset to start over.
					</p>
				)}
				<div className="mt-4 flex items-baseline gap-[18px] font-mono text-meta lg:mt-[18px] lg:gap-5">
					{quote && (
						<>
							<Link href="/quotes" className="text-ink-3 hover:text-ink-2">
								Open in Quotes →
							</Link>
							<button
								type="button"
								disabled={pending}
								onClick={() =>
									act(() => skipResurfacedQuoteAction(quote.id), "Couldn't skip quote.")
								}
								className="text-ink-3 hover:text-ink-2 active:opacity-70 disabled:opacity-50"
							>
								Next →
							</button>
						</>
					)}
					{skips > 0 && (
						<button
							type="button"
							disabled={pending}
							onClick={() => act(() => resetResurfacedAction(), "Couldn't reset skips.")}
							className="text-ink-4 hover:text-ink-2 active:opacity-70 disabled:opacity-50"
						>
							Reset
						</button>
					)}
				</div>
			</Card>
		</section>
	);
}
