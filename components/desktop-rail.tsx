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

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
	const active = isActive(item, pathname);
	return (
		<Link
			href={item.href}
			aria-current={active ? "page" : undefined}
			className={`block py-1.5 font-serif text-lg leading-tight transition-opacity active:opacity-70 ${
				active ? "text-accent" : "text-ink-2 hover:text-ink"
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
			className={`block py-1.5 font-mono text-meta uppercase tracking-widest transition-opacity active:opacity-70 ${
				active ? "text-accent" : "text-ink-3 hover:text-ink"
			}`}
		>
			{item.label}
		</Link>
	);
}

export function DesktopRail({ email }: { email: string }) {
	const pathname = usePathname();

	return (
		<aside className="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col border-r border-line bg-bg px-6 py-8 lg:flex">
			<Link href="/today" className="font-mono text-eyebrow uppercase tracking-widest text-ink">
				Dispatch
			</Link>

			<button
				type="button"
				onClick={() => openCapturePalette()}
				className="mt-8 flex items-center justify-between rounded-control border border-line-strong px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 transition-opacity hover:border-accent hover:text-ink active:opacity-70"
			>
				<span>+ Capture</span>
				<span aria-hidden="true" className="text-ink-4">
					⌘J
				</span>
			</button>

			<p className="mt-2 font-mono text-meta text-ink-4">
				<span aria-hidden="true">⌥1–5</span> jump to a tab
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

			<footer className="space-y-3 pt-6">
				<ThemeToggle />
				<p className="truncate text-meta text-ink-4" title={email}>
					{email}
				</p>
				<SignOutButton />
			</footer>
		</aside>
	);
}
