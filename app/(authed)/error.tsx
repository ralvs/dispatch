"use client";

import { useEffect } from "react";
import { Button, PageHeader } from "@/components/ui";

/**
 * Route-level fault. Pass 5 / B: failure owns the page — PageHeader names it,
 * plain operational English, primary recovery. Raw error stays in the console
 * (it may carry provider or network wording) and never in the UI.
 */
export default function RouteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div>
			<PageHeader title="Couldn't load" subtitle="Something failed while opening this page." />

			<Button type="button" variant="primary" onClick={reset}>
				Try again
			</Button>
		</div>
	);
}
