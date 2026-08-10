import { BrandMark } from "@/components/brand-mark";

/**
 * The mark plus the name, as the unauthenticated pages introduce the product:
 * /sign-in (twice — the session gate and the form) and the root not-found.
 * Three copies of the same six lines is a component, so here it is.
 *
 * Deliberately not shared with `app-header.tsx`, which sets its own pair (mark
 * at 26, `text-base`, `tracking-[-0.02em]`) inside a `/today` link. That is a
 * navigation control in a chrome bar, not an introduction; the two sizes are a
 * real distinction, not drift. If they should ever converge, that is a design
 * ruling, not a refactor.
 */
export function Wordmark() {
	return (
		<div className="flex items-center gap-2.5">
			<BrandMark size={22} />
			<span className="text-[15px] font-medium text-ink">Dispatch</span>
		</div>
	);
}
