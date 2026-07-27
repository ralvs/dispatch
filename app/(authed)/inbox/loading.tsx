export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Inbox</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The inbox</h1>
				<p className="mt-1 text-meta text-ink-3">
					Captured tasks without a home. Give each one a domain.
				</p>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<ul className="mt-4 space-y-3" aria-hidden="true">
				{Array.from({ length: 5 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<li key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</ul>
		</div>
	);
}
