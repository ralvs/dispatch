"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, TABS } from "@/components/nav-links";
import { toggleMoreMenu } from "@/lib/more-menu-bus";
import { DOCK_ACTION_SLOT_ID, DOCK_HEIGHT, DOCK_SURFACE } from "@/lib/ui/dock";

/**
 * The mobile dock: the desktop header's tab pill, moved to the thumb, with
 * capture as its own capsule beside it.
 *
 * More is a menu trigger (Pass 4 / C4), not a route. A1: it stays lit for every
 * destination the menu hosts so the bar always shows where you are.
 *
 * The active tab takes accent-soft with accent ink; capture takes solid ink
 * (lib/ui/dock.ts). Two signals, and they can never be read as one.
 */
export function BottomTabBar() {
	return <BottomTabBarView pathname={usePathname()} />;
}

/**
 * The same dock with the active tab passed in, so the layout can prerender it
 * as the Suspense fallback with `pathname={null}`.
 */
export function BottomTabBarView({ pathname }: { pathname: string | null }) {
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] lg:hidden">
			<nav aria-label="Primary" className="pointer-events-auto min-w-0">
				<ul className={`flex items-center gap-0.5 p-[5px] ${DOCK_HEIGHT} ${DOCK_SURFACE}`}>
					{TABS.map((tab) => {
						const active = isActive(tab, pathname);
						const className = `flex h-full items-center rounded-pill px-[9px] text-center font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-200 active:opacity-70 ${
							active ? "bg-accent-bg text-accent-ink" : "text-ink-3"
						}`;
						if (tab.key === "more") {
							return (
								<li key={tab.key} className="h-full">
									<button
										type="button"
										aria-haspopup="dialog"
										aria-current={active ? "true" : undefined}
										onClick={() => toggleMoreMenu()}
										className={className}
									>
										{tab.label}
									</button>
								</li>
							);
						}
						return (
							<li key={tab.key} className="h-full">
								<Link
									href={tab.href}
									aria-current={active ? "page" : undefined}
									className={className}
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
