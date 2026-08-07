/**
 * The Dispatch mark: an accent squircle with a dispatched chevron cut into it.
 * Drawn rather than imported — this is identity, not iconography, so the
 * Lucide-only rule does not reach it.
 *
 * `size` is the squircle's edge in px; the glyph scales with it.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
	const inset = size * 0.3;
	const stroke = Math.max(1.5, size * 0.077);
	return (
		<span
			aria-hidden="true"
			className="relative block shrink-0 bg-accent"
			style={{ width: size, height: size, borderRadius: size * 0.3 }}
		>
			<span
				className="absolute"
				style={{
					inset: `${inset}px ${inset * 0.88}px`,
					borderLeft: `${stroke}px solid #fff`,
					borderBottom: `${stroke}px solid #fff`,
					transform: "rotate(-45deg) translate(1px, -1px)",
				}}
			/>
		</span>
	);
}
