"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { isActive, TABS } from "@/components/nav-links";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { openCapturePalette } from "@/lib/capture/palette-bus";

/**
 * The desktop header (revision A), replacing the left rail: brand, a segmented
 * pill of tabs, and the two standing actions.
 *
 * The IA is unchanged — the same five destinations the phone dock carries,
 * straight from nav-links.ts, with More holding Chat, the Library and the
 * System pages exactly as it does on a phone. That is why losing the rail
 * costs nothing: everything the rail kept behind a disclosure already had a
 * home at /more.
 *
 * Ask and Capture are the only two `pill`-shaped controls on a page, and they
 * are deliberately unequal: Capture is ink-filled because it is the one action
 * the whole app exists to make cheap; Ask outlines beside it.
 *
 * Hidden below `lg`, where the dock (components/bottom-tab-bar.tsx) carries the
 * same five tabs and the same capture action into the thumb.
 */
export function AppHeader() {
	const pathname = usePathname();

	return (
		// mb-16 is the comp's 66px gap between the header and whatever a page
		// leads with. It lives here rather than on each page so a new route
		// inherits the rhythm instead of re-deriving it.
		<header className="mb-16 hidden items-center justify-between gap-5 lg:flex">
			<Link
				href="/today"
				className="flex items-center gap-2.5 text-base font-medium tracking-[-0.02em] text-ink"
			>
				<BrandMark />
				Dispatch
			</Link>

			<nav aria-label="Primary">
				<ul className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-[5px]">
					{TABS.map((tab) => {
						const active = isActive(tab, pathname);
						return (
							<li key={tab.key}>
								<Link
									href={tab.href}
									aria-current={active ? "page" : undefined}
									className={`block rounded-pill px-[18px] py-[7px] text-sm transition-colors ${
										active
											? "bg-surface font-medium text-ink elevation-card"
											: "text-ink-3 hover:text-ink-2"
									}`}
								>
									{tab.label}
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			<div className="flex items-center gap-2.5">
				<Link href="/chat" className={button({ shape: "pill", variant: "outline" })}>
					<Icon icon={MessageSquare} size="sm" />
					Ask
				</Link>
				{/* The rail used to print ⌘J beside this. The pill has no room for a
				    hint at 14px, so the binding moves to the tooltip rather than
				    disappearing entirely. */}
				<button
					type="button"
					title="Capture a thought  ⌘J"
					onClick={() => openCapturePalette()}
					className={button({ shape: "pill", variant: "primary" })}
				>
					Capture
				</button>
			</div>
		</header>
	);
}
