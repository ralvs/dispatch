"use client";

import { useEffect } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Keeps the access token fresh from the browser (docs/adr/0025).
 *
 * Without this, nothing refreshes the session until a *server* request finds
 * an expired access token — and on a PWA cold-open that is a burst of parallel
 * requests (document, RSC segments, one prefetch per bottom-tab Link), each in
 * its own lambda, each independently rotating the same refresh token. A
 * desktop tab never hits that: it stays warm, so the token is refreshed one
 * request at a time and never actually expires.
 *
 * Mounting the browser client is the whole job. auth-js starts an expiry-margin
 * ticker while the app is visible and registers a visibilitychange listener
 * that recovers the session when iOS resumes the PWA, and it serializes its own
 * refreshes behind navigatorLock — one writer, in the browser, writing the same
 * cookies the proxy reads. By the time any server request goes out, the token
 * is already fresh and nothing on the server needs to rotate anything.
 */
export function SessionKeeper() {
	useEffect(() => {
		// Constructing it is the subscription: the client is a browser-wide
		// singleton that wires up its own ticker and visibility listener.
		createBrowserSupabase();
	}, []);

	return null;
}
