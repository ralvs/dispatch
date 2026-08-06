"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "./tv";

/**
 * One shape, one disabled opacity, one transition, one focus treatment.
 * Call sites compose via the exported `button` tv object rather than retyping strings.
 *
 * Pill-shaped, sentence case, sans at 600 (docs/adr/0042). The old base was
 * `font-mono uppercase tracking-widest`, which made every control in the app
 * read as a terminal command rather than a product button. Labels are written
 * in sentence case at the call site; nothing here transforms them.
 */
export const button = tv({
	base: [
		"inline-flex items-center justify-center gap-2",
		"rounded-pill font-semibold",
		"transition-[background-color,border-color,color,box-shadow,transform] duration-200",
		"active:translate-y-px",
		"disabled:pointer-events-none disabled:opacity-50",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
	],
	variants: {
		variant: {
			// Warm near-black pill on paper — the system's one confident fill.
			// Only survives the variant merge because ./tv registers the type
			// scale — see the note there.
			primary: "bg-ink text-bg hover:opacity-90",

			secondary:
				"border border-line-strong bg-surface text-ink elevation-card hover:border-ink-4 hover:bg-surface-2",
			tertiary:
				"border border-line bg-transparent text-ink-2 hover:border-line-strong hover:bg-surface-2 hover:text-ink",
			ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
			danger:
				"border border-error/30 bg-transparent text-error hover:border-error/60 hover:bg-error/5",
			"danger-soft": "bg-transparent text-ink-4 hover:text-error",
		},
		size: {
			sm: "h-8 px-3 text-[13px]",
			md: "h-10 px-4 text-sm",
			lg: "h-11 px-5 text-[15px]",
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
		{ isIconOnly: true, size: "sm", class: "w-8" },
		{ isIconOnly: true, size: "md", class: "w-10" },
		{ isIconOnly: true, size: "lg", class: "w-11" },
		// A pill only reads as a button at button width. Stretched full-bleed it
		// becomes an 800px stadium that reads as a search field, so full-width
		// controls drop to the control radius instead.
		{ fullWidth: true, class: "rounded-control" },
	],
	defaultVariants: {
		variant: "primary",
		size: "md",
		isIconOnly: false,
		fullWidth: false,
		isPending: false,
	},
});

export type ButtonVariants = VariantProps<typeof button>;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	ButtonVariants & {
		children: ReactNode;
	};

export function Button({
	variant,
	size,
	isIconOnly,
	fullWidth,
	isPending,
	className,
	disabled,
	children,
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			disabled={disabled || Boolean(isPending)}
			aria-busy={isPending || undefined}
			className={button({ variant, size, isIconOnly, fullWidth, isPending, className })}
			{...props}
		>
			{children}
		</button>
	);
}
