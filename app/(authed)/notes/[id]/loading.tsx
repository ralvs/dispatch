export default function Loading() {
	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<span className="label">← Notes</span>
			</nav>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="space-y-3" aria-hidden="true">
				<div className="h-6 w-2/3 rounded bg-surface animate-pulse" />
				{Array.from({ length: 5 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
