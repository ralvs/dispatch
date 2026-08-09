"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { type ButtonVariants, button } from "./button-variants";

/**
 * One radius, one disabled opacity, one transition, one focus treatment.
 * Call sites compose via the `button` tv object rather than retyping strings.
 * It is imported here, not re-exported: this file is `"use client"`, and a
 * re-export through it would hand server callers the same client reference
 * that broke both not-found pages. Import it from ./button-variants.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	ButtonVariants & {
		children: ReactNode;
	};

export function Button({
	shape,
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
			className={button({ shape, variant, size, isIconOnly, fullWidth, isPending, className })}
			{...props}
		>
			{children}
		</button>
	);
}
