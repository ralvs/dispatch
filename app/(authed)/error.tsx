"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

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
				<p className="label">Error</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Something went sideways</h1>
				<p className="mt-1 text-meta text-ink-3">Something went wrong loading this page.</p>
			</header>

			<Button type="button" variant="primary" className="mt-6" onClick={reset}>
				Try again
			</Button>
		</div>
	);
}
