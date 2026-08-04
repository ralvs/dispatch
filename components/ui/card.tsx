import type { HTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

export const card = tv({
	base: ["rounded-card border border-line-strong bg-surface", "elevation-card"],
	variants: {
		padding: {
			default: "p-4",
			compact: "p-3",
			none: "p-0",
		},
	},
	defaultVariants: {
		padding: "default",
	},
});

export type CardVariants = VariantProps<typeof card>;

type CardProps = HTMLAttributes<HTMLDivElement> &
	CardVariants & {
		children: ReactNode;
	};

export function Card({ padding, className, children, ...props }: CardProps) {
	return (
		<div className={card({ padding, className })} {...props}>
			{children}
		</div>
	);
}
