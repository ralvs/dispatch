import { Bell, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { formatDateline } from "@/lib/dates";

export function Masthead({
	todayIso,
	unreadNotifications,
}: {
	todayIso: string;
	unreadNotifications: number;
}) {
	return (
		<header className="hairline-strong pb-4">
			<div className="flex items-baseline justify-between">
				{/* This is the page's only h1 — the dateline names the day this page
				 * is. The wordmark below stays a brand moment, not a heading. */}
				<h1 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					{formatDateline(todayIso)}
				</h1>
				<div className="flex items-center gap-4">
					{unreadNotifications > 0 && (
						<Link
							href="/notifications"
							className="flex items-center gap-1.5 font-mono text-meta text-ink-3 hover:text-ink-2"
						>
							<Icon icon={Bell} size="sm" />
							{unreadNotifications}
							<span
								aria-hidden
								className="inline-block h-1.5 w-1.5 self-center rounded-pill bg-accent"
							/>
							<span className="sr-only"> unread notifications</span>
						</Link>
					)}
					<Link
						href="/chat"
						className="flex items-center gap-1.5 font-mono text-meta text-accent-ink hover:text-accent"
					>
						<Icon icon={MessageSquare} size="sm" />
						Ask
					</Link>
				</div>
			</div>
			<p className="display-tight mt-1 w-fit font-serif text-t36 text-ink">Dispatch</p>
		</header>
	);
}
