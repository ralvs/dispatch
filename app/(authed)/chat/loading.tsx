export default function Loading() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Ask</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Chat</h1>
				<p className="mt-1 font-mono text-meta text-ink-4">
					Read-only over your tasks, notes, quotes, projects
				</p>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-6 space-y-3" aria-hidden="true">
				{Array.from({ length: 4 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
		</div>
	);
}
