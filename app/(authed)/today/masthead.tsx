import Link from "next/link";
import { formatDateline, formatDay } from "@/lib/dates";

export function Masthead({
	todayIso,
	tz,
	unreadNotifications,
}: {
	todayIso: string;
	tz: string;
	unreadNotifications: number;
}) {
	return (
		<header className="hairline-strong pb-5">
			<div className="flex items-baseline justify-between">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					{formatDateline(todayIso)}
				</p>
				<div className="flex items-baseline gap-4">
					{unreadNotifications > 0 && (
						<Link
							href="/notifications"
							className="flex items-baseline gap-1.5 font-mono text-meta text-ink-3 hover:text-ink-2"
						>
							<span aria-hidden className="inline-block h-1.5 w-1.5 self-center bg-accent" />
							{unreadNotifications}
							<span className="sr-only"> unread notifications</span>
						</Link>
					)}
					<Link href="/chat" className="font-mono text-meta text-ink-3 hover:text-ink-2">
						Ask →
					</Link>
				</div>
			</div>
			<h1 className="mt-1 font-serif text-4xl text-ink">Dispatch</h1>
			<p className="mt-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
				{formatDay(todayIso, tz)}
			</p>
		</header>
	);
}
