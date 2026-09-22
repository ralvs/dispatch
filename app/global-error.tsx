"use client";

import { useEffect } from "react";
import { button } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import "./globals.css";

/**
 * Root-layout fault. When `app/layout.tsx` itself throws, this replaces it —
 * `(authed)/error.tsx` sits below that layout and never sees the error.
 *
 * It renders its own document, so it can lean on nothing the root layout sets
 * up at runtime: no THEME_BOOT (the light tokens on `:root` are the default),
 * no SessionKeeper, no Geist variables (`--font-sans` falls through to Arial).
 * The stylesheet is imported here because Next does not carry global styles
 * into this document.
 *
 * Same frame as the root not-found. Recovery is a full reload, not `retry()`:
 * a layout that threw once is the thing most worth fetching again from scratch.
 * Raw error stays in the console, never in the UI.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<html lang="en" data-theme="light">
			<body>
				<title>Dispatch</title>
				<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
					<Wordmark />

					<h1 className="mt-5 text-t30 text-ink">Couldn't load</h1>

					<p className="mt-3 max-w-[36ch] text-sm leading-snug text-ink-2">
						Something failed before the app could open. Reloading usually fixes it.
					</p>

					<button
						type="button"
						onClick={() => window.location.reload()}
						className={`${button({ variant: "primary", shape: "pill" })} mt-8 w-fit`}
					>
						Reload
					</button>
				</main>
			</body>
		</html>
	);
}
