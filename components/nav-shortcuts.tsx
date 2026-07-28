"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DAILY } from "@/components/nav-links";
import { navShortcutIndex } from "@/lib/capture/shortcuts";

// Option/Alt+1..5 jumps straight to a Daily tab (Today, Tasks, Notes, Links,
// Chat) from anywhere in the app. Cmd+1..5 was rejected — the browser owns
// that binding for tab switching. Sourced from DAILY (nav-links.ts) so the
// shortcut list never drifts from the rail/tab-bar destinations.
export function NavShortcuts() {
	const router = useRouter();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
			}
			const index = navShortcutIndex(event);
			if (index === null) return;
			const tab = DAILY[index];
			if (!tab) return;
			event.preventDefault();
			router.push(tab.href);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router]);

	return null;
}
