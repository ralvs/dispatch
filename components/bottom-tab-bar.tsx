"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, TABS } from "@/components/nav-links";
import { DOCK_ACTION_SLOT_ID, DOCK_HEIGHT, DOCK_SURFACE } from "@/lib/ui/dock";

/**
 * The mobile dock (iOS-style): a compact tab pill and the capture button as one
 * centred row hovering over the scrolling content. Translucent surface +
 * backdrop blur, no extra dependency — the blur is `backdrop-filter` and
 * degrades to a near-opaque surface where unsupported. The row is fixed, so the
 * shell reserves room via `main`'s bottom padding.
 */
export function BottomTabBar() {
	const pathname = usePathname();

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:hidden">
			<nav aria-label="Primary" className="pointer-events-auto min-w-0">
				<ul className={`flex items-center gap-0.5 p-1 ${DOCK_HEIGHT} ${DOCK_SURFACE}`}>
					{TABS.map((tab) => {
						const active = isActive(tab, pathname);
						return (
							<li key={tab.key} className="h-full">
								<Link
									href={tab.href}
									aria-current={active ? "page" : undefined}
									className={`flex h-full items-center rounded-full px-2 text-center font-mono text-eyebrow uppercase tracking-normal transition-colors duration-200 active:opacity-70 ${
										active ? "bg-accent-bg text-accent" : "text-ink-3"
									}`}
								>
									{tab.label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>
			{/* Capture button lands here (components/capture-palette.tsx). `contents`
			    keeps it a direct flex child so both capsules share the baseline. */}
			<div id={DOCK_ACTION_SLOT_ID} className="contents" />
		</div>
	);
}
