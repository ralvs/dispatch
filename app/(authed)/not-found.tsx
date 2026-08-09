import Link from "next/link";
import { button, PageHeader } from "@/components/ui";

/*
 * Where `notFound()` from an authed page lands — a deleted note still linked
 * from a backlink, a hand-edited id in the URL.
 *
 * The status code is 200, not 404, and cannot be otherwise: the shell streams
 * (ADR-0033 §3 puts the auth hop behind Suspense, and every route has a
 * loading.tsx), so the response has already committed by the time a page's
 * dynamic read decides the row is missing. Nothing consumes that status here —
 * the app is single-user and behind auth, and the service worker never caches
 * authed HTML (public/sw.js) — so this file's job is the visible half: say
 * what happened in the app's own voice instead of Next's default black slab.
 *
 * Pass 5 / B: missing is a page, not an empty. PageHeader names it; recovery
 * is navigation, not a primary action (nothing to retry).
 */
export default function AuthedNotFound() {
	return (
		<div>
			<PageHeader title="Nothing here" subtitle="Deleted, or the link never pointed here." />

			<nav aria-label="Go elsewhere" className="flex flex-wrap gap-2">
				{[
					{ href: "/today", label: "Today" },
					{ href: "/tasks", label: "Tasks" },
					{ href: "/notes", label: "Notes" },
				].map(({ href, label }) => (
					<Link key={href} href={href} className={button({ variant: "secondary" })}>
						{label}
					</Link>
				))}
			</nav>
		</div>
	);
}
