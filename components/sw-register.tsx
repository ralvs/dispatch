"use client";

import { useEffect } from "react";

// Always-on registration for the offline/push service worker (production
// only — dev's Turbopack HMR and an active SW don't mix well). Renders
// nothing; PushToggle's own registration is idempotent against this one.
export function SwRegister() {
	useEffect(() => {
		if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
			navigator.serviceWorker.register("/sw.js");
		}
	}, []);

	return null;
}
