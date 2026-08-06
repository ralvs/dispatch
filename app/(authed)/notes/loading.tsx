export default function Loading() {
	return (
		<div>
			<header className="hairline-strong flex items-end justify-between pb-4">
				<div>
					<p className="label">Notes</p>
					<h1 className="mt-1 font-serif text-3xl text-ink">Loose thoughts</h1>
				</div>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<ul className="mt-4 space-y-3" aria-hidden="true">
				{Array.from({ length: 8 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<li key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</ul>
		</div>
	);
}
