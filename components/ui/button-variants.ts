import { tv, type VariantProps } from "./tv";

/**
 * The button's class recipe, deliberately outside `button.tsx`.
 *
 * `button.tsx` is `"use client"` because `Button` takes handlers, and a
 * `"use client"` module's exports are client references — calling one during a
 * server render throws. `button()` is a pure string function with no such
 * need, and server components do call it (both not-found pages style a `Link`
 * with it). Keeping the recipe here lets either side compose it.
 *
 * `button.tsx` imports it for its own use and does not re-export it — that
 * would hand server callers back the client reference this split exists to
 * avoid. The barrel (`./index.ts`) re-exports it from here, so `@/components/ui`
 * imports are unaffected; anything importing `button` from `./button` directly
 * has to point at this module instead.
 */
export const button = tv({
	base: [
		"inline-flex items-center justify-center gap-1.5",
		"transition-colors active:opacity-70",
		"disabled:pointer-events-none disabled:opacity-50",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
	],
	variants: {
		/**
		 * Two control voices, and they are not interchangeable.
		 *
		 * `control` is the quiet one the app is built from: mono, uppercase,
		 * 12px, control radius. It is the default because every existing call
		 * site expects it.
		 *
		 * `pill` is revision A's primary voice, lifted from the comps — sans,
		 * sentence case, 14px at weight 500, fully rounded. It is reserved for
		 * the shell's two standing actions (Ask and Capture) and the day nav's
		 * Today reset. Spending it on ordinary row controls would flatten the
		 * distinction it exists to make.
		 */
		shape: {
			control: "rounded-control font-mono text-eyebrow uppercase tracking-widest",
			pill: "rounded-pill font-sans text-sm font-medium",
		},
		variant: {
			// Canvas ink on a filled control. Only survives the variant merge
			// because ./tv registers the type scale — see the note there.
			primary: "bg-ink text-bg hover:opacity-90",

			secondary:
				"border border-line-strong bg-transparent text-ink-3 hover:border-accent hover:text-ink",
			tertiary:
				"border border-line bg-transparent text-ink-3 hover:border-line-strong hover:text-ink",
			// The comp's `.pill-ghost`: a hairline outline carrying full ink, the
			// quiet half of the shell's action pair. Distinct from `secondary`,
			// which mutes its label to ink-3 and reserves the accent for hover.
			outline: "border border-line-strong bg-transparent text-ink hover:border-ink-4",
			ghost: "bg-transparent text-ink-3 hover:bg-surface hover:text-ink",
			danger: "border border-error/40 bg-transparent text-error hover:border-error",
			"danger-soft": "bg-transparent text-ink-4 hover:text-accent-slip",
		},
		size: {
			sm: "h-7 px-2.5 text-eyebrow",
			md: "h-9 px-3 text-eyebrow",
			lg: "h-11 px-4 text-sm",
		},
		isIconOnly: {
			true: "px-0",
			false: "",
		},
		fullWidth: {
			true: "w-full",
			false: "",
		},
		isPending: {
			true: "opacity-50",
			false: "",
		},
	},
	compoundVariants: [
		{ isIconOnly: true, size: "sm", class: "w-7" },
		{ isIconOnly: true, size: "md", class: "w-9" },
		{ isIconOnly: true, size: "lg", class: "w-11" },
		// A pill is wider and taller than a control at the same nominal size:
		// it carries sentence-case sans, which needs the room.
		{ shape: "pill", size: "sm", class: "h-8 px-4 text-meta" },
		{ shape: "pill", size: "md", class: "h-10 px-5" },
		{ shape: "pill", size: "lg", class: "h-12 px-6" },
		{ shape: "pill", isIconOnly: true, size: "sm", class: "w-8 px-0" },
		{ shape: "pill", isIconOnly: true, size: "md", class: "w-10 px-0" },
		{ shape: "pill", isIconOnly: true, size: "lg", class: "w-12 px-0" },
	],
	defaultVariants: {
		shape: "control",
		variant: "primary",
		size: "md",
		isIconOnly: false,
		fullWidth: false,
		isPending: false,
	},
});

export type ButtonVariants = VariantProps<typeof button>;
