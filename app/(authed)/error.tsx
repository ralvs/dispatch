"use client";

export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Error</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Something went sideways</h1>
				<p className="mt-1 text-meta text-ink-3">
					{error.message || "An unexpected error occurred."}
				</p>
			</header>

			<button
				type="button"
				onClick={reset}
				className="mt-6 rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg"
			>
				Try again
			</button>
		</div>
	);
}
