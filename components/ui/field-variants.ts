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
 * Field shape comes entirely from --field-* tokens. Size changes height
 * and type scale only.
 */
export const fieldControl = tv({
	base: [
		"field-shell w-full text-ink outline-none",
		"placeholder:text-ink-4",
		"disabled:cursor-not-allowed disabled:opacity-50",
	],
	variants: {
		size: {
			sm: "h-7 px-0 text-eyebrow",
			md: "h-9 px-0 text-sm",
			lg: "h-11 px-0 text-base",
		},
	},
	defaultVariants: {
		size: "md",
	},
});

export type FieldControlVariants = VariantProps<typeof fieldControl>;
