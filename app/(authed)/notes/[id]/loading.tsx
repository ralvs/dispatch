export default function Loading() {
	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">← Notes</span>
			</nav>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_16.25rem] lg:items-start">
				<div className="measure-prose space-y-3" aria-hidden="true">
					<div className="h-8 w-2/3 rounded bg-surface animate-pulse" />
					{Array.from({ length: 5 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
						<div key={i} className="h-4 rounded bg-surface animate-pulse" />
					))}
				</div>
				<div className="space-y-6" aria-hidden="true">
					<div className="space-y-2">
						<div className="h-4 w-24 rounded bg-surface animate-pulse" />
						<div className="h-10 w-full rounded bg-surface animate-pulse" />
						<div className="h-10 w-full rounded bg-surface animate-pulse" />
					</div>
					<div className="space-y-2">
						<div className="h-4 w-16 rounded bg-surface animate-pulse" />
						<div className="h-10 w-full rounded bg-surface animate-pulse" />
					</div>
				</div>
			</div>
		</div>
	);
}
