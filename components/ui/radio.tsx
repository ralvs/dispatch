"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { tv } from "tailwind-variants";

export const radio = tv({
	slots: {
		root: "inline-flex cursor-pointer items-center gap-2",
		box: [
			"relative inline-flex h-4 w-4 shrink-0 items-center justify-center",
			"rounded-pill border border-line-strong bg-surface",
			"transition-colors peer-checked:border-ink",
			"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
			"peer-disabled:opacity-50",
			"after:absolute after:h-2 after:w-2 after:rounded-pill after:bg-ink after:opacity-0",
			"peer-checked:after:opacity-100",
		],
		input: "peer sr-only",
		label: "text-sm text-ink",
	},
});

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
	children?: ReactNode;
	className?: string;
};

export function Radio({ children, className, id, ...props }: RadioProps) {
	const styles = radio();
	return (
		<label className={styles.root({ className })} htmlFor={id}>
			<span className="relative inline-flex">
				<input id={id} type="radio" className={styles.input()} {...props} />
				<span className={styles.box()} aria-hidden />
			</span>
			{children != null && <span className={styles.label()}>{children}</span>}
		</label>
	);
}
