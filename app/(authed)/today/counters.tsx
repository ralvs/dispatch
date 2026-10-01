"use client";

import Link from "next/link";
import { useAggregate } from "@/lib/store";

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
 *
 * Every count but events reads the entity store (#26, #27, #28), so a tick, a
 * filed note or a mark-read anywhere moves it without a page render. The props are
 * the server's numbers, used until the store holds its own.
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
	const storeEvents = useAggregate("events.today") ?? events;
	const storeOpen = useAggregate("tasks.open") ?? open;
	const storeOverdue = useAggregate("tasks.overdue") ?? overdue;
	const storeInbox = useAggregate("tasks.inbox") ?? inbox;
	const storeUnread = useAggregate("notifications.unread") ?? notifications;
	const storeReview = useAggregate("notes.needsReview") ?? needsReview;
	// The comps show four. The last two are here because the sections this
	// composition cut were the only places they appeared, and both are things
	// waiting on a decision — which is what this block is. They are rare, and
	// every row is conditional, so an ordinary day still reads as four.
	const rows = [
		{
			key: "events",
			count: storeEvents,
			label: storeEvents === 1 ? "event" : "events",
			href: "/today",
		},
		{ key: "open", count: storeOpen, label: "open", href: "/tasks" },
		{ key: "overdue", count: storeOverdue, label: "overdue", href: "/tasks", late: true },
		{ key: "inbox", count: storeInbox, label: "in the inbox", href: "/inbox" },
		{ key: "review", count: storeReview, label: "need review", href: "/notes" },
		{ key: "unread", count: storeUnread, label: "notifications", href: "/notifications" },
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
