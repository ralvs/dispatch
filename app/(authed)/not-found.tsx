import Link from "next/link";

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
 */
export default function AuthedNotFound() {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="label">Not found</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Nothing at this address</h1>
				<p className="mt-1 text-meta text-ink-3">
					It was deleted, or the link points somewhere that never existed.
				</p>
			</header>

			<nav aria-label="Go elsewhere" className="mt-6 flex flex-wrap gap-2">
				{[
					{ href: "/today", label: "Today" },
					{ href: "/tasks", label: "Tasks" },
					{ href: "/notes", label: "Notes" },
				].map(({ href, label }) => (
					<Link
						key={href}
						href={href}
						className="rounded-pill border border-line-strong px-3 py-2 label hover:border-accent hover:text-ink active:translate-y-px"
					>
						{label}
					</Link>
				))}
			</nav>
		</div>
	);
}
