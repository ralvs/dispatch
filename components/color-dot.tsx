/** Small color marker rendered wherever a colored domain/project name appears. */
export function ColorDot({ color }: { color?: string | null }) {
	if (!color) return null;
	return (
		<span
			aria-hidden="true"
			className="inline-block size-2.5 shrink-0 rounded-full"
			style={{ backgroundColor: color }}
		/>
	);
}
