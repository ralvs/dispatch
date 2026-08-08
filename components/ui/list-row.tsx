import type { ReactNode } from "react";

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
 * Rows keep their own composition. A `variant` prop per surface is the failure
 * mode — if a third one is about to be added, the abstraction is wrong and only
 * the geometry should have moved (day-row.tsx header comment; Pass 1 held it).
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
}) {
	const alignClass = align === "start" ? "items-start" : "items-center";
	return (
		<li className={`hairline flex min-h-12 gap-3 py-3 ${alignClass} ${className}`}>
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
 */
export const ROW_TITLE_CLASS =
	"block min-w-0 truncate text-base font-normal leading-[1.35] tracking-[-0.01em] text-ink";
