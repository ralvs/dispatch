import Link from "next/link";
import { formatDateline } from "@/lib/dates";

function IconBell({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M4 6a4 4 0 0 1 8 0c0 3 1 4 1 4H3s1-1 1-4Z" />
			<path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
		</svg>
	);
}

function IconMessage({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M2 3.5h12v7H6l-2.5 2.5V10.5H2Z" />
		</svg>
	);
}

export function Masthead({
	todayIso,
	unreadNotifications,
}: {
	todayIso: string;
	unreadNotifications: number;
}) {
	return (
		<header className="hairline-strong pb-5">
			<div className="flex items-baseline justify-between">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					{formatDateline(todayIso)}
				</p>
				<div className="flex items-center gap-4">
					{unreadNotifications > 0 && (
						<Link
							href="/notifications"
							className="flex items-center gap-1.5 font-mono text-meta text-ink-3 hover:text-ink-2"
						>
							<IconBell />
							{unreadNotifications}
							<span
								aria-hidden
								className="inline-block h-1.5 w-1.5 self-center rounded-full bg-accent"
							/>
							<span className="sr-only"> unread notifications</span>
						</Link>
					)}
					<Link
						href="/chat"
						className="flex items-center gap-1.5 font-mono text-meta text-accent-ink hover:text-accent"
					>
						<IconMessage />
						Ask
					</Link>
				</div>
			</div>
			<h1 className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">Dispatch</h1>
		</header>
	);
}
