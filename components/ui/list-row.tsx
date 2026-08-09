import type { ReactNode } from "react";
import { tv } from "./tv";

/**
 * Shared list-row geometry — nothing else.
 *
 * Pass 0 specified this and left it unbuilt (zero callers). Pass 1 was told not
 * to (one caller is not a shared shape). Pass 2 has nine: the task row, the
 * Today row, and the seven list surfaces rebuilt in this pass. What they share
 * is only the shell:
 *
 *   hairline · min-h-12 · py-3 · gap-3 · leading / body / trailing
 *
 * Rows keep their own composition. Two hatches already on the shell:
 *   - `align` — multi-line bodies need `start`.
 *   - `className` — **state** only (pending dim at opacity-50, selected). The
 *     pending language is system-wide (DESIGN.md, Button.isPending is the
 *     canonical instance); do not add a second `pending` prop here.
 *
 * A per-surface `variant` prop remains the failure mode — if a third one is
 * about to be added, the abstraction is wrong and only the geometry should
 * have moved (day-row.tsx header comment; Pass 1 held it).
 *
 * The 44px touch target on a row control is the control's job (hit-area /
 * checkbox slug), not this shell's.
 */
export function ListRow({
	leading,
	children,
	trailing,
	className = "",
	align = "center",
	id,
}: {
	/** Left column — domain dot, checkbox, mark. Holds width even when empty
	 *  if the caller renders a held slot (DESIGN.md, Invisible Slot Rule). */
	leading?: ReactNode;
	/** The row's body: title, meta, whatever the surface is built around. */
	children: ReactNode;
	/** Right column — badge, star, actions. */
	trailing?: ReactNode;
	className?: string;
	/** `start` for multi-line bodies (quotes, links, notifications). */
	align?: "center" | "start";
	/** Anchor target (e.g. domain deep-links). */
	id?: string;
}) {
	const alignClass = align === "start" ? "items-start" : "items-center";
	return (
		<li id={id} className={`hairline flex min-h-12 gap-3 py-3 ${alignClass} ${className}`}>
			{leading}
			<div className="min-w-0 flex-1">{children}</div>
			{trailing}
		</li>
	);
}

/**
 * Body-size row name at 400. The system's only weight step is reserved for the
 * things that earn it — P1 on a task, a SectionHead, a page title — not every
 * name on every list (Gate A / A1, Pass 2; DESIGN.md Two Weights Rule).
 *
 * A variant function rather than a class string, for two reasons this pass
 * found the hard way. Fusing type with layout meant the three rows that need a
 * different box — the task row's hit-area link, Today's flex child, the
 * notification's multi-line body — re-typed `leading-[1.35] tracking-[-0.01em]`
 * by hand, so the ramp lived in four strings. And appending a colour to a class
 * string that already carries `text-ink` only wins by stylesheet order, which
 * is not a thing a call site can reason about: `tv` merges through
 * tailwind-merge, so `tone` resolves deterministically instead.
 *
 * `tone` and `emphasis` together carry the done/P1 rule that task-row.tsx and
 * day-row.tsx each spelled out separately.
 */
export const rowTitle = tv({
	base: "text-base font-normal leading-[1.35] tracking-[-0.01em]",
	variants: {
		tone: {
			default: "text-ink",
			/** Read, seen, secondary — a name that is still a name. */
			muted: "text-ink-2",
			done: "text-ink-4 line-through",
		},
		/** The one weight step. Spend it only where DESIGN.md says it means something. */
		emphasis: {
			normal: "",
			strong: "font-medium",
		},
		layout: {
			/** The default row name: its own block, truncating at the row's edge. */
			block: "block min-w-0 truncate",
			/** A flex child taking the remaining width of its row. */
			fill: "min-w-0 flex-1 truncate",
			/** Caller owns the box — a multi-line body, or a link with a hit area. */
			bare: "",
		},
	},
	defaultVariants: { tone: "default", emphasis: "normal", layout: "block" },
});
