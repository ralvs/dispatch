import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";

/**
 * Small colour marker rendered wherever a coloured domain/project name
 * appears. The value is a palette slug, resolved to a theme-aware token
 * (`var(--domain-<slug>)`) rather than painted as a stored hex — see
 * lib/schemas/color.ts for why storage changed shape.
 *
 * A value that is not one of the nine slots renders nothing — unless `hold` is
 * set, in which case the 9px slot stays (invisible) so a list of mixed filed
 * and unfiled rows keeps one left edge (DESIGN.md, Invisible Slot Rule). That
 * is the honest fallback for a pre-migration value too: better a held gap than
 * a colour from an identity two visual worlds ago.
 *
 * Size is 9px, the measured floor the palette was tuned against
 * (.impeccable/mocks/palette-lab.html).
 */
export function ColorDot({
	color,
	hold = false,
}: {
	color?: string | null;
	/** Keep the 9px slot when the colour is absent. */
	hold?: boolean;
}) {
	if (!isColorSlug(color)) {
		if (!hold) return null;
		return (
			<span
				aria-hidden="true"
				className="inline-block size-[9px] shrink-0 rounded-full invisible"
			/>
		);
	}
	return (
		<span
			aria-hidden="true"
			className="inline-block size-[9px] shrink-0 rounded-full"
			style={{ backgroundColor: colorSlugVar(color) }}
		/>
	);
}
