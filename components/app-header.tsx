"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { isActive, TABS } from "@/components/nav-links";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { openCapturePalette } from "@/lib/capture/palette-bus";
import { toggleMoreMenu } from "@/lib/more-menu-bus";

/**
 * The desktop header (revision A): brand, a segmented pill of tabs, and the
 * two standing actions.
 *
 * More is a menu trigger (Pass 4 / C4), not a link to a page. It stays lit for
 * every destination the menu hosts (A1) so the coarse locator still answers
 * "where am I?" when you stand on Projects or Settings.
 *
 * Ask and Capture are the only two `pill`-shaped controls on a page, and they
 * are deliberately unequal: Capture is ink-filled because it is the one action
 * the whole app exists to make cheap; Ask outlines beside it.
 *
 * Hidden below `lg`, where the dock carries the same five tabs.
 */
export function AppHeader() {
	const pathname = usePathname();

	return (
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
						const className = `block rounded-pill px-[18px] py-[7px] text-sm transition-colors ${
							active
								? "bg-surface font-medium text-ink elevation-card"
								: "text-ink-3 hover:text-ink-2"
						}`;
						if (tab.key === "more") {
							return (
								<li key={tab.key}>
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
							<li key={tab.key}>
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

			<div className="flex items-center gap-2.5">
				<Link href="/chat" className={button({ shape: "pill", variant: "outline" })}>
					<Icon icon={MessageSquare} size="sm" />
					Ask
				</Link>
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
