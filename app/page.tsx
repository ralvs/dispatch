// Placeholder landing — becomes redirect('/today') once the authed shell
// exists (Phase 1). For now it proves the token system and fonts render.
export default function Home() {
	return (
		<main className="mx-auto max-w-xl px-6 py-16">
			<p className="font-mono text-eyebrow uppercase text-ink-3">Dispatch · scaffold</p>
			<h1 className="mt-2 font-serif text-4xl text-ink">The paper is set.</h1>
			<p className="mt-4 text-sm text-ink-2">
				Voice in, order out. Phase 0 scaffold — tokens, fonts, and tooling verified.
			</p>
			<div className="hairline-strong mt-8" />
			<dl className="mt-4 space-y-2 font-mono text-meta text-ink-3">
				<div className="flex justify-between">
					<dt>accent</dt>
					<dd className="text-accent">■ rust</dd>
				</div>
				<div className="flex justify-between">
					<dt>surface</dt>
					<dd>
						<span className="bg-surface-2 px-2 py-0.5 text-ink-2">raised</span>
					</dd>
				</div>
				<div className="flex justify-between">
					<dt>slipping</dt>
					<dd className="font-serif italic text-accent-slip">4 days</dd>
				</div>
			</dl>
		</main>
	);
}
