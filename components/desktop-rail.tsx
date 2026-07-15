"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isActive, RAIL_EXTRAS, TABS } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { openCapturePalette } from "@/lib/capture/palette-bus";
import { createBrowserSupabase } from "@/lib/supabase/browser";

function RailLink({ item, pathname }: { item: (typeof TABS)[number]; pathname: string }) {
	const active = isActive(item, pathname);
	return (
		<Link
			href={item.href}
			aria-current={active ? "page" : undefined}
			className={`block py-1.5 font-serif text-lg leading-tight ${
				active ? "text-accent" : "text-ink-2 hover:text-ink"
			}`}
		>
			{item.label}
		</Link>
	);
}

export function DesktopRail({ email, theme }: { email: string; theme: "dark" | "light" }) {
	const pathname = usePathname();
	const router = useRouter();

	async function signOut() {
		await createBrowserSupabase().auth.signOut();
		router.push("/sign-in");
		router.refresh();
	}

	return (
		<aside className="fixed inset-y-0 left-0 z-30 hidden w-52 flex-col border-r border-line bg-bg px-6 py-8 lg:flex">
			<Link href="/today" className="font-mono text-eyebrow uppercase tracking-widest text-ink">
				Dispatch
			</Link>

			<button
				type="button"
				onClick={openCapturePalette}
				className="mt-8 flex items-center justify-between border border-line-strong px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink"
			>
				<span>+ Capture</span>
				<span aria-hidden="true" className="text-ink-4">
					⌘J
				</span>
			</button>

			<nav aria-label="Primary" className="mt-10 flex-1">
				{TABS.map((t) => (
					<RailLink key={t.key} item={t} pathname={pathname} />
				))}
				<div className="hairline my-4" />
				{RAIL_EXTRAS.map((t) => (
					<RailLink key={t.key} item={t} pathname={pathname} />
				))}
				<div className="hairline my-4" />
				<Link
					href="/notifications"
					className="block py-1.5 font-mono text-meta uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					Notifications
				</Link>
				<Link
					href="/settings"
					className="block py-1.5 font-mono text-meta uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					Settings
				</Link>
			</nav>

			<footer className="space-y-3">
				<ThemeToggle current={theme} />
				<p className="truncate text-meta text-ink-4" title={email}>
					{email}
				</p>
				<button
					type="button"
					onClick={signOut}
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-accent"
				>
					Sign out
				</button>
			</footer>
		</aside>
	);
}
