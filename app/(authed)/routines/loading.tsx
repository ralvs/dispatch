export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="label">Routines</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Daily habits</h1>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-6 space-y-3" aria-hidden="true">
				{Array.from({ length: 5 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
