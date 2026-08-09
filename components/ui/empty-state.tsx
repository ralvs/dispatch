import type { ReactNode } from "react";

/**
 * A list with nothing in it says so in words rather than collapsing.
 *
 * Two idioms met here and one had to go. The linen era centred its empties and
 * set them in a serif italic (`py-8 text-center font-serif italic`), which put
 * the quietest text on the page on the strongest axis — dead centre — and
 * needed a display face the system no longer has. Today's is left-aligned on
 * the same edge as the rows it stands in for, so an empty band reads as a band
 * that is empty rather than as a message about one.
 *
 * Today's is the precedent and it wins. The italic survives the loss of the
 * serif: it is what separates a sentence the app is saying from a title a
 * person wrote, and it is the only italic in the chrome.
 *
 * `hint` sets upright beneath the lead — it is an instruction, not more of the
 * same sentence, and the roman is what says so.
 *
 * `divider` keeps the hairline Today's in-card placeholders carry, where the
 * empty stands in the position of a row and the row below still needs its rule.
 * A page-level empty has nothing under it and takes none.
 */
export function EmptyState({
	children,
	hint,
	divider = false,
}: {
	children: ReactNode;
	hint?: ReactNode;
	divider?: boolean;
}) {
	return (
		<p
			className={`text-base italic text-ink-3 ${
				divider ? "border-b border-line pt-6 pb-7" : "py-8"
			}`}
		>
			{children}
			{hint && <span className="mt-1.5 block text-sm not-italic text-ink-4">{hint}</span>}
		</p>
	);
}
