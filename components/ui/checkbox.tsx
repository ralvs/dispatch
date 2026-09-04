"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { TODAY_VARIANT } from "@/lib/ui/variant";
import { Icon } from "./icon";
import { tv } from "./tv";

/**
 * The ring + halo that encode high / medium / low — one hue at three
 * intensities. Shared with the task-form picker so a selected priority
 * and a list checkbox cannot drift.
 *
 * High is solid with a halo, medium the same red at 42% and a quieter
 * halo, low the plain grey rule.
 */
export const PRIORITY_MARK = {
	high: "border-priority-high shadow-[0_0_0_3.5px_var(--priority-high-halo)]",
	medium: "border-priority-med shadow-[0_0_0_3.5px_var(--priority-med-halo)]",
	low: "border-line-strong",
} as const;

export const checkbox = tv({
	slots: {
		root: "inline-flex cursor-pointer items-center gap-2",
		box: [
			// 19px with a 7px squircle: the comps' mark, and the reason
			// --radius-mark is 7 rather than the old 3.
			"relative inline-flex h-[19px] w-[19px] shrink-0 items-center justify-center",
			"rounded-mark border-[1.5px] border-line-strong bg-surface text-surface",
			"transition-colors peer-checked:border-ink peer-checked:bg-ink",
			"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
			"peer-disabled:opacity-50",
			"[&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100",
			// A 44px touch slug the mark never has to draw. Sized from the box,
			// so it stays centred whatever the mark's own dimensions are.
			"before:absolute before:-inset-[12.5px] before:content-['']",
		],
		input: "peer sr-only",
		label: "text-base text-ink",
	},
	variants: {
		/**
		 * Priority as a ring on the box — the signal sits on the thing you
		 * actually reach for, which is the whole point of the A2 composition.
		 *
		 * One hue at three intensities, never three hues: the seven domain
		 * colours already sit on the same row as filled dots, so a third hue
		 * would collide with Travel's brass.
		 *
		 * Suppressed entirely under the `rail` variant, where a left rail
		 * carries priority instead (lib/ui/variant.ts).
		 */
		priority: {
			high: { box: PRIORITY_MARK.high },
			medium: { box: PRIORITY_MARK.medium },
			low: { box: PRIORITY_MARK.low },
			none: {},
		},
	},
	defaultVariants: {
		priority: "none",
	},
});

/** P1 is high, P2 medium, P3/P4 low. Three intensities, four stored levels. */
export function priorityRing(priority: number | null | undefined): "high" | "medium" | "low" {
	if (priority === 1) return "high";
	if (priority === 2) return "medium";
	return "low";
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
	children?: ReactNode;
	className?: string;
	/**
	 * Draw the task's priority as a ring. Pass the stored 1–4; the mapping to
	 * three intensities lives here so no call site repeats it. Omit on
	 * checkboxes that are not tasks — routines have no priority.
	 */
	priority?: number | null;
};

/**
 * Real <label> wrapper so padding/hit-area is clickable (fixes routine-check-row).
 * Not field-shaped — mark geometry is fixed across all data-ui variants.
 */
export function Checkbox({ children, className, id, priority, ...props }: CheckboxProps) {
	const ring =
		priority == null || TODAY_VARIANT !== "ring" ? ("none" as const) : priorityRing(priority);
	const styles = checkbox({ priority: ring });
	return (
		<label className={styles.root({ className })} htmlFor={id}>
			<span className="relative inline-flex">
				<input id={id} type="checkbox" className={styles.input()} {...props} />
				<span className={styles.box()} aria-hidden>
					<Icon icon={Check} size="sm" className="h-3.5 w-3.5" strokeWidth={2.25} />
				</span>
			</span>
			{children != null && <span className={styles.label()}>{children}</span>}
		</label>
	);
}
