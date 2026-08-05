"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "./tv";

/**
 * One radius, one disabled opacity, one transition, one focus treatment.
 * Call sites compose via the exported `button` tv object rather than retyping strings.
 */
export const button = tv({
	base: [
		"inline-flex items-center justify-center gap-1.5",
		"rounded-control font-mono text-eyebrow uppercase tracking-widest",
		"transition-colors active:opacity-70",
		"disabled:pointer-events-none disabled:opacity-50",
		"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
	],
	variants: {
		variant: {
			// Canvas ink on a filled control. Only survives the variant merge
			// because ./tv registers the type scale — see the note there.
			primary: "bg-ink text-bg hover:opacity-90",

			secondary:
				"border border-line-strong bg-transparent text-ink-3 hover:border-accent hover:text-ink",
			tertiary:
				"border border-line bg-transparent text-ink-3 hover:border-line-strong hover:text-ink",
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
