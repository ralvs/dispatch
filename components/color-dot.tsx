import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";

/**
 * Small colour marker rendered wherever a coloured domain/project name
 * appears. The value is a palette slug, resolved to a theme-aware token
 * (`var(--domain-<slug>)`) rather than painted as a stored hex — see
 * lib/schemas/color.ts for why storage changed shape.
 *
 * A value that is not one of the nine slots renders nothing. That is the
 * honest fallback: a row written before the migration would otherwise paint a
 * colour from an identity two visual worlds ago.
 */
export function ColorDot({ color }: { color?: string | null }) {
	if (!isColorSlug(color)) return null;
	return (
		<span
			aria-hidden="true"
			className="inline-block size-2.5 shrink-0 rounded-full"
			style={{ backgroundColor: colorSlugVar(color) }}
		/>
	);
}
