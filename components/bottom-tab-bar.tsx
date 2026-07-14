"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, TABS } from "@/components/nav-links";

export function BottomTabBar() {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
		>
			<ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
				{TABS.map((tab) => {
					const active = isActive(tab, pathname);
					return (
						<li key={tab.key} className="flex-1">
							<Link
								href={tab.href}
								aria-current={active ? "page" : undefined}
								className={`block px-1 py-3 text-center font-mono text-eyebrow uppercase tracking-widest ${
									active ? "text-accent" : "text-ink-3"
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
