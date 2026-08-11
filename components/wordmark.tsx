import { BrandMark } from "@/components/brand-mark";

/**
 * The mark plus the name, as the unauthenticated pages introduce the product:
 * /sign-in (twice — the session gate and the form) and the root not-found.
 * Three copies of the same six lines is a component, so here it is.
 *
 * The name is `.type-section`, the same role app-header's wordmark uses. It
 * was `text-[15px]` in Pass 5, off the authored ramp and one pixel adrift of
 * the header's 16 for no recorded reason; the two now agree.
 *
 * The mark itself stays at 22 against the header's 26. That difference is
 * real: the header is chrome and sits beside a nav, this is an introduction
 * on an otherwise empty page.
 */
export function Wordmark() {
	return (
		<div className="flex items-center gap-2.5">
			<BrandMark size={22} />
			<span className="type-section text-ink">Dispatch</span>
		</div>
	);
}
