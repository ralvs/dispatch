"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryNav } from "@/components/library-nav";
import {
	DAILY,
	isActive,
	isGroupActive,
	LIBRARY,
	type NavItem,
	SYSTEM,
} from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { openCapturePalette } from "@/lib/capture/palette-bus";

/**
 * Nav rows carry their active state as a filled surface, not just a colour
 * shift (docs/adr/0042) — on the paper ground a tinted pill is legible at a
 * glance where a recoloured word was not.
 */
function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
	const active = isActive(item, pathname);
	return (
		<Link
			href={item.href}
			aria-current={active ? "page" : undefined}
			className={`block rounded-control px-3 py-2 text-sm font-semibold transition-colors active:translate-y-px ${
				active ? "bg-accent-bg text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
			}`}
		>
			{item.label}
		</Link>
	);
}

function SystemLink({ item, pathname }: { item: NavItem; pathname: string }) {
	const active = isActive(item, pathname);
	return (
		<Link
			href={item.href}
			aria-current={active ? "page" : undefined}
			className={`block rounded-control px-3 py-1.5 text-[13px] font-medium transition-colors active:translate-y-px ${
				active ? "bg-accent-bg text-accent-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
			}`}
		>
			{item.label}
		</Link>
	);
}

export function DesktopRail({ email }: { email: string }) {
	const pathname = usePathname();

	return (
		<aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-bg px-4 py-8 lg:flex">
			<Link href="/today" className="px-3 font-serif text-base text-ink">
				Dispatch
			</Link>

			<button
				type="button"
				onClick={() => openCapturePalette()}
				className="mt-8 flex items-center justify-between gap-2 rounded-pill border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-ink elevation-card transition-colors hover:border-ink-4 hover:bg-surface-2 active:translate-y-px"
			>
				<span>Capture</span>
				<span aria-hidden="true" className="text-meta text-ink-4">
					⌘J
				</span>
			</button>

			<p className="mt-2 px-3 text-meta text-ink-4">
				<span aria-hidden="true">⌥1-5</span> jump to a tab
			</p>

			<nav aria-label="Primary" className="mt-10 flex-1 overflow-y-auto">
				{DAILY.map((t) => (
					<RailLink key={t.key} item={t} pathname={pathname} />
				))}

				<div className="hairline my-4" />
				<LibraryNav hasActiveChild={isGroupActive(LIBRARY, pathname)}>
					{LIBRARY.map((t) => (
						<RailLink key={t.key} item={t} pathname={pathname} />
					))}
				</LibraryNav>

				<div className="hairline my-4" />
				{SYSTEM.map((t) => (
					<SystemLink key={t.key} item={t} pathname={pathname} />
				))}
			</nav>

			<footer className="space-y-2 pt-6">
				<ThemeToggle />
				<p className="truncate px-3 text-meta text-ink-4" title={email}>
					{email}
				</p>
				<SignOutButton />
			</footer>
		</aside>
	);
}
