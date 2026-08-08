"use client";

import { useEffect } from "react";
import { Button, PageHeader } from "@/components/ui";

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
			<PageHeader
				title="Something went sideways"
				subtitle="Something went wrong loading this page."
			/>

			<Button type="button" variant="primary" onClick={reset}>
				Try again
			</Button>
		</div>
	);
}
