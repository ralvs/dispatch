"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInForm } from "@/components/sign-in-form";
import { Wordmark } from "@/components/wordmark";
import { browserAuth } from "@/lib/supabase/browser";

/**
 * The owner's way in; the OAuth consent page is the other unauthenticated
 * UI (docs/adr/0079). Pass 5: brand mark introduces the product,
 * then a page-weight title — no mono eyebrow, no hairline (the silhouette
 * ADR-0042 deleted; this page sat outside every prior sweep).
 *
 * Behaviour is load-bearing and is not a design concern: the checkingSession
 * gate, recovery client, and redirect contract come from ADR-0025 and
 * ADR-0032. proxy.ts keeps /sign-in outside the matcher so recovery can
 * refresh without a redirect loop.
 */
export default function SignInPage() {
	const router = useRouter();
	// True until we know there is no recoverable browser session. Avoids a
	// flash of the form when cold-start recovery is about to redirect (ADR-0032).
	const [checkingSession, setCheckingSession] = useState(true);
	useEffect(() => {
		let cancelled = false;
		const auth = browserAuth();

		// Cold-start path: proxy bounced us here because the *server* couldn't
		// prove ownership (expired access + concurrent refresh, or a brief
		// JWKS miss). The refresh cookie often still sits in document.cookie
		// and is still valid server-side (not revoked). One serial browser
		// refresh recovers it — password re-entry is the wrong fix.
		void (async () => {
			try {
				const { data, error } = await auth.getSession();
				if (cancelled) return;
				if (!error && data.session) {
					router.replace("/today");
					router.refresh();
					return;
				}
			} catch {
				// Fall through to the form — recovery is best-effort.
			}
			if (!cancelled) setCheckingSession(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [router]);

	function onSignedIn() {
		// Refresh so server components re-render with the new session.
		router.push("/today");
		router.refresh();
	}

	if (checkingSession) {
		return (
			<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
				<Wordmark />
				<p className="mt-5 text-sm text-ink-3" role="status">
					Checking session…
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<Wordmark />

			<h1 className="mt-5 text-t30 text-ink">Sign in</h1>

			<SignInForm onSignedIn={onSignedIn} />
		</main>
	);
}
