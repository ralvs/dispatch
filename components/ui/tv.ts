import { createTV } from "tailwind-variants";

/**
 * The project's `tv`, taught about our custom type scale.
 *
 * tailwind-merge classifies `text-<unknown>` as a *color*, so the theme's
 * `text-eyebrow` / `text-meta` (font sizes, see `@theme` in app/globals.css)
 * were colliding with real text colors: a variant that set both dropped one of
 * them silently — that is how the primary button lost its label colour and
 * rendered as a blank fill. Registering them under the `text` theme scale puts
 * them back in the font-size group, where they only conflict with each other.
 *
 * Every `tv()` call site in components/ui imports from here rather than from
 * tailwind-variants directly.
 */
export const tv = createTV({
	twMergeConfig: { extend: { theme: { text: ["eyebrow", "meta"] } } },
});

export type { VariantProps } from "tailwind-variants";
