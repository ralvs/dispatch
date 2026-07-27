export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Settings</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The back office</h1>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-6 space-y-3" aria-hidden="true">
				{Array.from({ length: 7 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
