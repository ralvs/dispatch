"use client";

import { useEffect } from "react";

export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	// Keep the raw error out of the UI (it may carry provider/network wording)
	// but still surface it to devtools for debugging.
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Error</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Something went sideways</h1>
				<p className="mt-1 text-meta text-ink-3">Something went wrong loading this page.</p>
			</header>

			<button
				type="button"
				onClick={reset}
				className="mt-6 rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg transition-opacity active:opacity-70"
			>
				Try again
			</button>
		</div>
	);
}
