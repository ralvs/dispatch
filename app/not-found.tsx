import Link from "next/link";
import { button } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";

/*
 * Unmatched URLs — no route segment claims them, so the router decides this
 * before anything renders and the status really is 404 (unlike the authed
 * not-found, where the shell has already streamed; see (authed)/not-found.tsx).
 *
 * The root layout carries no chrome, so this borrows the unauthenticated
 * frame (centred column at max-w-sm). Pass 5 / B: brand mark introduces the
 * app, then a page-weight title — no mono eyebrow, no hairline (the legacy
 * silhouette ADR-0042 deleted). "Go to Dispatch" points at /today; a
 * signed-out visitor lands on /sign-in from there, which is the right answer
 * for someone who never had a session.
 */
export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<Wordmark />

			<h1 className="mt-5 text-t30 text-ink">Nothing here</h1>

			<p className="mt-3 max-w-[36ch] text-sm leading-snug text-ink-2">
				That URL doesn't lead anywhere. Mistyped, or it never existed.
			</p>

			<Link href="/today" className={`${button({ variant: "outline", shape: "pill" })} mt-8 w-fit`}>
				Go to Dispatch
			</Link>
		</main>
	);
}
