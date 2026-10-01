"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { pullTodayAction } from "@/app/(authed)/today/actions";
import { parseDateIso } from "@/lib/dates";
import { isNavigationError, useStoreActions } from "@/lib/store";

const DEFAULT_MS = 5 * 60 * 1000;

/**
 * Keep Today honest without a page render (#4): every five minutes, and on
 * return to a tab hidden that long, pull Today's snapshots into the entity
 * store — the day's bands, the counters, the masthead badge, the routines
 * card, the project rings. That is how a cron's write reaches an open tab.
 *
 * It used to call router.refresh(), which re-rendered Today and wiped every
 * route's client cache with it (ADR-0034 fact #2). The one thing a pull cannot
 * do is move the page to a new day: when the server's today is past the
 * page's, it refreshes once — at most once a day.
 *
 * Skips ticks while the tab is hidden. A failed pull is invisible: the screen
 * keeps what it had, and the next tick tries again.
 */
export function SoftRefresh({
	todayIso,
	intervalMs = DEFAULT_MS,
}: {
	/** The day this render of Today is for. */
	todayIso: string;
	intervalMs?: number;
}) {
	const router = useRouter();
	const { seed } = useStoreActions();
	const lastPullAt = useRef(Date.now());
	const inFlight = useRef(false);

	useEffect(() => {
		async function pull() {
			if (inFlight.current) return;
			inFlight.current = true;
			lastPullAt.current = Date.now();
			try {
				// The day on screen: DayView keeps it in `?d=` (history.replaceState).
				const shown = parseDateIso(new URLSearchParams(window.location.search).get("d"));
				const snapshots = await pullTodayAction(shown ?? undefined);
				if (snapshots.some((s) => s.todayIso !== todayIso)) {
					router.refresh();
					return;
				}
				for (const snapshot of snapshots) seed(snapshot);
			} catch (error) {
				// Invisible on purpose. A redirect (an expired session) navigates
				// on its own — it is not a failure (lib/store/run.ts).
				if (!isNavigationError(error)) console.error("Today pull failed", error);
			} finally {
				inFlight.current = false;
			}
		}

		function maybePull() {
			if (document.visibilityState !== "visible") return;
			if (Date.now() - lastPullAt.current < intervalMs) return;
			void pull();
		}

		const id = window.setInterval(maybePull, intervalMs);
		document.addEventListener("visibilitychange", maybePull);
		return () => {
			window.clearInterval(id);
			document.removeEventListener("visibilitychange", maybePull);
		};
	}, [router, seed, todayIso, intervalMs]);

	return null;
}
