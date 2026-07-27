export default function Loading() {
	return (
		<div>
			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="hairline-strong space-y-3 pb-4" aria-hidden="true">
				<div className="h-3 w-20 rounded bg-surface animate-pulse" />
				<div className="h-8 w-1/2 rounded bg-surface animate-pulse" />
			</div>

			<div className="mt-6 space-y-3" aria-hidden="true">
				{Array.from({ length: 5 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
