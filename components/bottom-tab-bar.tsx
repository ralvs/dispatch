"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, TABS } from "@/components/nav-links";

/**
 * Floating pill tab bar (iOS-style): a compact capsule that hovers over the
 * scrolling content instead of a full-width docked bar. Translucent
 * surface + backdrop blur, no extra dependency — the blur is
 * `backdrop-filter` and degrades to a near-opaque surface where unsupported.
 * The bar is fixed, so the shell reserves room via `main`'s bottom padding.
 */
export function BottomTabBar() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Primary"
			className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden"
		>
			<ul className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-line-strong/70 bg-surface/75 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150">
				{TABS.map((tab) => {
					const active = isActive(tab, pathname);
					return (
						<li key={tab.key}>
							<Link
								href={tab.href}
								aria-current={active ? "page" : undefined}
								className={`flex min-h-11 items-center rounded-full px-3 text-center font-mono text-eyebrow uppercase tracking-normal transition-colors duration-200 active:opacity-70 ${
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
	);
}
