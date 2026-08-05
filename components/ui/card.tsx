import type { HTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "./tv";

export const card = tv({
	base: ["rounded-card border border-line-strong bg-surface elevation-card"],
	variants: {
		padding: {
			default: "p-5",
			compact: "p-4",
			comfortable: "p-6",
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
