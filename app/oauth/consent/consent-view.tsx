"use client";

import { useCallback, useEffect, useState } from "react";
import { SignInForm } from "@/components/sign-in-form";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { browserAuth } from "@/lib/supabase/browser";

// Ported from ralvs/echo app/oauth/consent/page.tsx (its ADR-0023), keeping
// its three fixes to the Supabase response: the client is `name`/`id`, the
// scope is one space-separated string, and a request the owner already
// granted comes back without an authorization_id and must redirect at once.

/** Only a web URL may be followed; anything else (javascript:, data:) is refused. */
function isWebUrl(url: string): boolean {
	try {
		const { protocol } = new URL(url);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

const BAD_REDIRECT = "The assistant sent an invalid return address. Try connecting again.";

type Details = { clientName: string; scopes: string[] };
type View = "loading" | "sign-in" | "consent" | "done";

export function ConsentView() {
	const [view, setView] = useState<View>("loading");
	const [details, setDetails] = useState<Details | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [deciding, setDeciding] = useState(false);
	// undefined until read: a query param read on the client only, so the
	// page needs no Suspense boundary for useSearchParams.
	const [authorizationId, setAuthorizationId] = useState<string | null | undefined>(undefined);

	useEffect(() => {
		setAuthorizationId(new URLSearchParams(window.location.search).get("authorization_id"));
	}, []);

	const load = useCallback(async (id: string) => {
		const { data, error } = await browserAuth().oauth.getAuthorizationDetails(id);
		if (error || !data) {
			setError("Couldn't load the connection request. Try connecting again.");
			setView("consent");
			return;
		}
		if (!("authorization_id" in data)) {
			// Already granted: Supabase auto-approved, hand straight back.
			if (!isWebUrl(data.redirect_url)) {
				setError(BAD_REDIRECT);
				setView("consent");
				return;
			}
			setView("done");
			window.location.replace(data.redirect_url);
			return;
		}
		setDetails({
			clientName: data.client.name || data.client.id,
			scopes: data.scope.split(/\s+/).filter(Boolean),
		});
		setView("consent");
	}, []);

	useEffect(() => {
		if (authorizationId === undefined) return;
		if (!authorizationId) {
			setError("This page needs a connection request. Start again from your assistant.");
			setView("consent");
			return;
		}
		let cancelled = false;
		void (async () => {
			const { data } = await browserAuth().getSession();
			if (cancelled) return;
			if (data.session) await load(authorizationId);
			else setView("sign-in");
		})();
		return () => {
			cancelled = true;
		};
	}, [authorizationId, load]);

	async function decide(approve: boolean) {
		if (!authorizationId) return;
		setDeciding(true);
		setError(null);
		const oauth = browserAuth().oauth;
		const { data, error } = approve
			? await oauth.approveAuthorization(authorizationId)
			: await oauth.denyAuthorization(authorizationId);
		if (error || !data?.redirect_url) {
			setError("Couldn't finish the request. Try again.");
			setDeciding(false);
			return;
		}
		if (!isWebUrl(data.redirect_url)) {
			setError(BAD_REDIRECT);
			setDeciding(false);
			return;
		}
		setView("done");
		// Back to the client, carrying the authorization code (or the denial).
		window.location.replace(data.redirect_url);
	}

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-24">
			<Wordmark />
			<h1 className="mt-5 text-t30 text-ink">Connect an assistant</h1>

			{view === "loading" && (
				<p className="mt-5 text-sm text-ink-3" role="status">
					Loading request…
				</p>
			)}

			{view === "sign-in" && authorizationId && (
				<>
					<p className="mt-5 text-sm text-ink-3">Sign in to continue.</p>
					<SignInForm onSignedIn={() => load(authorizationId)} />
				</>
			)}

			{view === "consent" && (
				<div className="mt-8 space-y-7">
					{details && (
						<>
							<p className="text-ink">
								<strong className="font-medium">{details.clientName}</strong> wants to read and
								change your Dispatch data as you.
							</p>
							{details.scopes.length > 0 && (
								<ul aria-label="Requested scopes" className="space-y-1 text-sm text-ink-3">
									{details.scopes.map((scope) => (
										<li key={scope}>{scope}</li>
									))}
								</ul>
							)}
						</>
					)}
					{error && (
						<p role="alert" className="text-sm text-error">
							{error}
						</p>
					)}
					{details && (
						<div className="space-y-3">
							<Button
								type="button"
								variant="primary"
								shape="pill"
								fullWidth
								size="md"
								isPending={deciding}
								disabled={deciding}
								onClick={() => decide(true)}
							>
								Allow
							</Button>
							<Button
								type="button"
								variant="outline"
								shape="pill"
								fullWidth
								size="md"
								disabled={deciding}
								onClick={() => decide(false)}
							>
								Deny
							</Button>
						</div>
					)}
				</div>
			)}

			{view === "done" && (
				<p className="mt-5 text-sm text-ink-3" role="status">
					Redirecting you back…
				</p>
			)}
		</main>
	);
}
