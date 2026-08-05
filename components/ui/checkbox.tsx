"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";
import { tv } from "./tv";

export const checkbox = tv({
	slots: {
		root: "inline-flex cursor-pointer items-center gap-2",
		box: [
			"relative inline-flex h-4 w-4 shrink-0 items-center justify-center",
			"rounded-mark border border-line-strong bg-surface text-bg",
			"transition-colors peer-checked:border-ink peer-checked:bg-ink",
			"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
			"peer-disabled:opacity-50",
			"[&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100",
		],
		input: "peer sr-only",
		label: "text-sm text-ink",
	},
});

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
	children?: ReactNode;
	className?: string;
};

/**
 * Real <label> wrapper so padding/hit-area is clickable (fixes routine-check-row).
 * Not field-shaped — mark geometry is fixed across all data-ui variants.
 */
export function Checkbox({ children, className, id, ...props }: CheckboxProps) {
	const styles = checkbox();
	return (
		<label className={styles.root({ className })} htmlFor={id}>
			<span className="relative inline-flex">
				<input id={id} type="checkbox" className={styles.input()} {...props} />
				<span className={styles.box()} aria-hidden>
					<Icon icon={Check} size="sm" className="h-3 w-3" />
				</span>
			</span>
			{children != null && <span className={styles.label()}>{children}</span>}
		</label>
	);
}
