import Link from "next/link";

/*
 * Unmatched URLs — no route segment claims them, so the router decides this
 * before anything renders and the status really is 404 (unlike the authed
 * not-found, where the shell has already streamed; see (authed)/not-found.tsx).
 *
 * The root layout carries no chrome, so this borrows the sign-in page's
 * centered frame rather than the app shell. "Go to Dispatch" points at /today;
 * a signed-out visitor lands on /sign-in from there, which is the right answer
 * for someone who never had a session.
 */
export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<p className="font-mono text-eyebrow uppercase text-ink-3">Dispatch</p>
			<h1 className="mt-1 font-serif text-3xl text-ink">Nothing at this address</h1>
			<div className="hairline-strong mt-6" />
			<p className="mt-6 text-meta text-ink-3">
				That URL doesn't lead anywhere. It may have been mistyped, or it never existed.
			</p>

			<Link
				href="/today"
				className="mt-8 w-fit rounded-md border border-line-strong px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink active:opacity-70"
			>
				Go to Dispatch
			</Link>
		</main>
	);
}
