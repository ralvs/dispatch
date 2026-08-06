export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="label">Notifications</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The ledger</h1>
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
