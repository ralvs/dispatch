import Link from "next/link";

/**
 * The day's weight in four numbers, riding off the headline's baseline.
 *
 * These are **today's** counts and they do not follow the day nav — Today* is
 * locked to the real calendar today (ADR-0036), so stepping to Friday does not
 * change how much is open or how much is overdue right now. That is also why
 * they sit outside `.t-day-owned` and never dim.
 *
 * Overdue takes the accent and nothing else does. One orange on the page means
 * one thing: this needs you.
 *
 * On a phone they run as one wrapped line rather than a grid of stat tiles —
 * four numbers are a sentence about the day, not a dashboard.
 */
function Counter({
	count,
	label,
	href,
	late,
}: {
	count: number;
	label: string;
	href: string;
	late?: boolean;
}) {
	return (
		<Link
			href={href}
			className={`whitespace-nowrap text-sm hover:underline ${late ? "text-accent" : "text-ink-2"}`}
		>
			<b className={`mr-1.5 text-base font-medium tabular-nums ${late ? "" : "text-ink"}`}>
				{count}
			</b>
			{label}
		</Link>
	);
}

export function Counters({
	events,
	open,
	overdue,
	inbox,
	needsReview,
	notifications,
}: {
	events: number;
	open: number;
	overdue: number;
	inbox: number;
	/** Notes the parser could not place — iron rule #4's safety net. */
	needsReview: number;
	notifications: number;
}) {
	// The comps show four. The last two are here because the sections this
	// composition cut were the only places they appeared, and both are things
	// waiting on a decision — which is what this block is. They are rare, and
	// every row is conditional, so an ordinary day still reads as four.
	const rows = [
		{ key: "events", count: events, label: events === 1 ? "event" : "events", href: "/today" },
		{ key: "open", count: open, label: "open", href: "/tasks" },
		{ key: "overdue", count: overdue, label: "overdue", href: "/tasks", late: true },
		{ key: "inbox", count: inbox, label: "in the inbox", href: "/inbox" },
		{ key: "review", count: needsReview, label: "need review", href: "/notes" },
		{ key: "unread", count: notifications, label: "notifications", href: "/notifications" },
	].filter((row) => row.count > 0);

	if (rows.length === 0) return null;

	return (
		<nav
			className="mt-5 flex flex-wrap gap-x-[18px] gap-y-1.5 lg:mt-0 lg:grid lg:shrink-0 lg:justify-items-end lg:gap-[7px] lg:pb-1.5"
			aria-label="Today at a glance"
		>
			{rows.map(({ key, ...row }) => (
				<Counter key={key} {...row} />
			))}
		</nav>
	);
}
