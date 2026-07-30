"use client";

import { useEffect } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Keeps the access token fresh from the browser (docs/adr/0025, 0032).
 *
 * Without this, nothing refreshes the session until a *server* request finds
 * an expired access token — and on a PWA cold-open that is a burst of parallel
 * requests (document, RSC segments, one prefetch per bottom-tab Link), each in
 * its own lambda, each independently rotating the same refresh token. A
 * desktop tab never hits that: it stays warm, so the token is refreshed one
 * request at a time and never actually expires.
 *
 * Mounted on the *root* layout (not only authed) so:
 * 1. A bounce to /sign-in after a failed proxy check still has a single
 *    browser writer that can recover a still-valid refresh cookie.
 * 2. auth-js starts its expiry-margin ticker and visibilitychange listener
 *    as soon as any page hydrates — including the sign-in form.
 *
 * Constructing the browser client is the whole job: auth-js wires the ticker
 * and serializes refreshes behind navigatorLock, writing the same cookies the
 * proxy reads.
 */
export function SessionKeeper() {
	useEffect(() => {
		// Constructing it is the subscription: the client is a browser-wide
		// singleton that wires up its own ticker and visibility listener.
		createBrowserSupabase();
	}, []);

	return null;
}
