import type { ReactNode } from "react";

/**
 * One completion figure, two renderings.
 *
 * `ring` is a conic-gradient arc with a punched centre that can carry its own
 * reading ("5/8", a remaining count); `bar` is a flat track with a filled
 * head. They are the single axis the two Today compositions differ on, so
 * every call site takes its rendering from `PROGRESS_RENDER`
 * (lib/ui/variant.ts) rather than choosing one — switching the whole page back
 * to bars is a one-line change there.
 *
 * The ring's centre is punched with an opaque disc rather than a mask, so it
 * needs to know what it sits on: `holeClass` defaults to `bg-surface` because
 * every ring in the comps sits on a card.
 *
 * Colour is a CSS colour string, not a token name — projects pass a domain
 * colour (`var(--domain-code)`) and routines pass ink, and neither is a
 * Tailwind class the arc could take.
 */
type ProgressProps = {
	/** Completed portion, 0..1. Clamped. */
	value: number;
	render: "bar" | "ring";
	/** What a screen reader hears. The visible `children` is never enough — a
	 * bare "5/8" does not say what is being counted. */
	label: string;
	/** Drawn inside the ring. Ignored by `bar`, which has no room for it. */
	children?: ReactNode;
	/** Arc/fill colour. Any CSS colour; defaults to ink. */
	color?: string;
	/** Ring diameter in px. Ignored by `bar`. */
	size?: number;
	/** Ring stroke in px — the inset of the punched centre. Ignored by `bar`. */
	thickness?: number;
	/** What the ring's centre is punched against. */
	holeClass?: string;
	className?: string;
};

export function Progress({
	value,
	render,
	label,
	children,
	color = "var(--ink)",
	size = 52,
	thickness = 6,
	holeClass = "bg-surface",
	className,
}: ProgressProps) {
	const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);

	if (render === "bar") {
		return (
			<div
				role="progressbar"
				aria-label={label}
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
				className={`h-[7px] overflow-hidden rounded-pill bg-surface-2 ${className ?? ""}`}
			>
				<span
					className="block h-full rounded-pill"
					style={{ width: `${pct}%`, background: color }}
				/>
			</div>
		);
	}

	return (
		<span
			role="progressbar"
			aria-label={label}
			aria-valuenow={pct}
			aria-valuemin={0}
			aria-valuemax={100}
			className={`relative grid shrink-0 place-items-center rounded-full ${className ?? ""}`}
			style={{
				width: size,
				height: size,
				// The `0` second stop is doing real work: it collapses the
				// transition so the arc ends hard instead of feathering.
				background: `conic-gradient(${color} ${pct}%, var(--surface-2) 0)`,
			}}
		>
			<span
				aria-hidden="true"
				className={`absolute rounded-full ${holeClass}`}
				style={{ inset: thickness }}
			/>
			{children != null && (
				<span className="relative font-mono text-meta tabular-nums text-ink-2">{children}</span>
			)}
		</span>
	);
}
