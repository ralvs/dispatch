import type { HTMLAttributes, ReactNode } from "react";
import { tv, type VariantProps } from "./tv";

/**
 * A white card floating on the warm paper ground (docs/adr/0042). Depth comes
 * from the tinted shadow, not from a strong border — the hairline is there to
 * define the edge in dark mode, where surface and canvas sit closer together.
 */
export const card = tv({
	base: ["rounded-card border border-line bg-surface elevation-card"],
	variants: {
		padding: {
			default: "p-6",
			compact: "p-4",
			comfortable: "p-8",
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
