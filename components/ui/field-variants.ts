import { tv, type VariantProps } from "./tv";

/**
 * The field shell's class recipe, outside `field.tsx` for the same reason
 * `button-variants.ts` sits outside `button.tsx`: `field.tsx` is
 * `"use client"`, every export of a client module is a client reference, and
 * calling one during a server render throws. `fieldControl()` is a pure string
 * function, so it lives here where either side can compose it.
 *
 * This one is the sharper case of the two. Its caller invokes it at module
 * scope (`app/(authed)/tasks/task-fields.tsx`, `export const CONTROL =
 * fieldControl({ size: "md" })`), which runs at import time rather than at
 * render — so the throw would not wait for a component to be rendered, it
 * would fire the moment a server module pulled that file into its graph.
 *
 * Field shape comes entirely from --field-* tokens (data-ui variant swap).
 * Every field — title or meta — uses the same shell. Size only changes height
 * and type scale; it never forks the chrome into "line vs box".
 */
export const fieldControl = tv({
	base: [
		"field-shell w-full text-ink outline-none transition-colors",
		"placeholder:text-ink-4",
		"disabled:cursor-not-allowed disabled:opacity-50",
		"hover:border-line-strong focus:border-line-strong",
		"data-[invalid]:border-error",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
	],
	variants: {
		size: {
			sm: "h-7 px-2.5 text-eyebrow",
			md: "h-9 px-2.5 text-sm",
			lg: "h-11 px-3 text-base",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

export type FieldControlVariants = VariantProps<typeof fieldControl>;
