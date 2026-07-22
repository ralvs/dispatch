"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const DEFAULT_MS = 5 * 60 * 1000;

/**
 * Soft-refresh the current RSC tree on an interval so time-sensitive UI
 * (day tape "now", past events, counts) stays honest without a hard reload.
 *
 * Skips ticks while the tab is hidden; refreshes once on return if the
 * interval has elapsed while away.
 */
export function SoftRefresh({ intervalMs = DEFAULT_MS }: { intervalMs?: number }) {
	const router = useRouter();
	const lastRefreshAt = useRef(Date.now());

	useEffect(() => {
		function refresh() {
			lastRefreshAt.current = Date.now();
			router.refresh();
		}

		function maybeRefresh() {
			if (document.visibilityState !== "visible") return;
			if (Date.now() - lastRefreshAt.current < intervalMs) return;
			refresh();
		}

		const id = window.setInterval(maybeRefresh, intervalMs);
		document.addEventListener("visibilitychange", maybeRefresh);
		return () => {
			window.clearInterval(id);
			document.removeEventListener("visibilitychange", maybeRefresh);
		};
	}, [router, intervalMs]);

	return null;
}
