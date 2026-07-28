export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-5">
				<div className="flex items-baseline justify-between">
					<div className="h-3 w-24 rounded bg-surface animate-pulse" aria-hidden="true" />
				</div>
				<h1 className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">
					Dispatch
				</h1>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-12 space-y-4" aria-hidden="true">
				{Array.from({ length: 8 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
