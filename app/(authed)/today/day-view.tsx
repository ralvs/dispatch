"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { completeTaskAction, reopenTaskAction, setTop3Action } from "@/lib/actions/tasks";
import { parseDateIso } from "@/lib/dates";
import type { TaskRow } from "@/lib/services/tasks";
import { useDispatchStore, useStoreActions, useView, viewKey } from "@/lib/store";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import type { DomainColorSource } from "@/lib/ui/event-color";
import { loadDayScheduleAction } from "./actions";
import { OpenSection, TimelineSection, Top3Section } from "./day-bands";
import { DayHeadline } from "./day-headline";
import { DayNav } from "./day-nav";
import { DayTape } from "./day-tape";

// Module-level so handlersFor's dependency list can be honest: a fresh object
// literal each render would make the callback identity churn for nothing.
const WRITE_ACTIONS = {
	complete: completeTaskAction,
	reopen: reopenTaskAction,
	setTop3: setTop3Action,
};

/**
 * A day already in the store paints at once; one fetched longer ago than this
 * is also re-read in the background. Writes do not need it — they land in the
 * store — so this only catches what changed elsewhere: a cron's calendar sync,
 * another tab.
 */
const REVALIDATE_AFTER_MS = 60_000;

function hrefFor(dateIso: string, todayIso: string): string {
	return dateIso === todayIso ? "/today" : `/today?d=${dateIso}`;
}

// The day tape + schedule list. Day schedules live in the entity store, keyed
// by date (#26): the page's <Seed> fed the first one, and a chevron only reloads
// getDaySchedule (via Server Action) into the store — never the full Today RSC
// payload or the route's skeleton. `?d=` is kept in the URL with
// history.replaceState for deep links and SoftRefresh honesty.
export function DayView({
	dateIso: initialDateIso,
	todayIso,
	domains = [],
	counters,
	calendarHealth,
	aside,
	quote,
}: {
	/** The day the page's seed holds. Equals todayIso unless `?d=` named another. */
	dateIso: string;
	todayIso: string;
	/** Active domains — calendar names that match a domain borrow its colour. */
	domains?: readonly DomainColorSource[];
	/**
	 * Today's own sections, rendered on the server and slotted into this
	 * region's grid. They are passed in rather than rendered here because none
	 * of them follows the day — they are locked to the real today (ADR-0036) —
	 * but they share the page's two-column stack, and the stack has to be one
	 * tree for the phone reorder to work at all.
	 */
	counters: React.ReactNode;
	/** Stale or failing calendar feeds (#96), under the headline; usually empty. */
	calendarHealth?: React.ReactNode;
	aside: React.ReactNode;
	quote: React.ReactNode;
}) {
	const [dateIso, setDateIso] = useState(initialDateIso);
	// A navigation that names another day (the Today tab while `?d=` is set)
	// re-renders the page with a new seed day; follow it. Adjusted during
	// render, not in an effect, so the old day never paints in between.
	const [seededIso, setSeededIso] = useState(initialDateIso);
	if (seededIso !== initialDateIso) {
		setSeededIso(initialDateIso);
		setDateIso(initialDateIso);
	}
	const view = useView(viewKey.day(dateIso));
	const api = useDispatchStore();
	const { seed } = useStoreActions();
	const [pending, startTransition] = useTransition();
	// Ignore stale action results when the user clicks faster than the network.
	const requestGen = useRef(0);
	// When each day was last read, on this device's clock. The seed's own day
	// counts as read at mount.
	const [readAtMs] = useState(() => new Map<string, number>());
	useEffect(() => {
		if (!readAtMs.has(initialDateIso)) readAtMs.set(initialDateIso, Date.now());
	}, [readAtMs, initialDateIso]);
	// Dedupes concurrent background reads per day.
	const inFlight = useRef(new Set<string>());

	// Background re-read for a day the store already holds. Deliberately NOT
	// wrapped in startTransition — `pending` (and the dim it drives) must stay
	// false here, since a background refresh should never look like a
	// foreground fetch. The store decides what wins: a read older than a write
	// the user made meanwhile never overwrites it.
	const revalidate = useCallback(
		(nextIso: string) => {
			if (inFlight.current.has(nextIso)) return;
			// Don't burn a phone's radio re-reading a day nobody's looking at
			// (matches app/(authed)/today/soft-refresh.tsx's visibility check).
			if (document.visibilityState !== "visible") return;
			inFlight.current.add(nextIso);
			loadDayScheduleAction(nextIso)
				.then((snapshot) => {
					readAtMs.set(nextIso, Date.now());
					seed(snapshot);
				})
				.catch((error) => {
					// A failed background refresh must be invisible — the user still has
					// correct-as-of-a-minute-ago content on screen.
					unstable_rethrow(error);
				})
				.finally(() => {
					inFlight.current.delete(nextIso);
				});
		},
		[readAtMs, seed],
	);

	const selectDay = useCallback(
		(nextIso: string, opts?: { syncUrl?: boolean }) => {
			if (nextIso === dateIso) return;
			const gen = ++requestGen.current;
			if (opts?.syncUrl !== false) {
				window.history.replaceState(window.history.state, "", hrefFor(nextIso, todayIso));
			}

			// A day already in the store wins, always: it paints instantly and an
			// aged one is re-read in the background — never a skeleton for a day
			// already seen.
			if (api.getState().views[viewKey.day(nextIso)]) {
				setDateIso(nextIso);
				const last = readAtMs.get(nextIso);
				if (last === undefined || Date.now() - last >= REVALIDATE_AFTER_MS) revalidate(nextIso);
				return;
			}

			startTransition(async () => {
				const snapshot = await loadDayScheduleAction(nextIso);
				readAtMs.set(nextIso, Date.now());
				seed(snapshot);
				if (gen !== requestGen.current) return;
				setDateIso(nextIso);
			});
		},
		[api, dateIso, todayIso, readAtMs, seed, revalidate],
	);

	// Back/forward after replaceState is rare (we replace, not push) but a
	// shared or bookmarked `?d=` can still land via popstate from another page.
	useEffect(() => {
		function onPopState() {
			const params = new URLSearchParams(window.location.search);
			const d = parseDateIso(params.get("d")) ?? todayIso;
			selectDay(d, { syncUrl: false });
		}
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, [selectDay, todayIso]);

	// One store for the whole day: Top 3 and the Timeline sit in different
	// columns and can hold the same task, and both read this one view, so a
	// tick cannot land in one and not the other.
	const run = useTaskIntentRunner();
	const handlersFor = useCallback(
		(task: TaskRow) =>
			bindTaskHandlers(task, run, WRITE_ACTIONS, { top3DateIso: dateIso, todayIso }),
		[run, dateIso, todayIso],
	);

	// The page's <Seed> always holds the day it names, and a chevron only moves
	// once its day is in the store — so this is a guard, not a state.
	if (!view) return null;
	const projected = view.schedule;

	const placement = {
		schedule: projected,
		dateIso: view.dateIso,
		todayIso,
		handlersFor,
		eventNoteIds: view.eventNoteIds,
		taskNoteIds: view.taskNoteIds,
		domains,
	};

	return (
		// data-pending drives .t-day-owned's dim (today-styles.tsx). Only what
		// the nav actually changes carries that class — the counters, routines,
		// projects and the quote are today's whatever day is on screen, and must
		// not flicker when a chevron moves.
		<div data-pending={pending || undefined}>
			{/* The nav is the dateline: on desktop it is the eyebrow above the
			    headline, and on a phone it sticks to the top of the scroller so
			    the day survives the headline scrolling away. */}
			<div className="sticky top-0 z-20 -mx-5 mb-6 flex items-center bg-bg/85 px-5 py-3 backdrop-blur-lg backdrop-saturate-150 lg:static lg:mx-0 lg:mb-4 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
				<DayNav dateIso={view.dateIso} todayIso={todayIso} pending={pending} onSelect={selectDay} />
			</div>

			<div className="lg:flex lg:items-end lg:justify-between lg:gap-12">
				<DayHeadline
					timeline={projected.timeline}
					isToday={view.dateIso === todayIso}
					nowUtcIso={view.nowUtcIso}
				/>
				{counters}
			</div>
			{calendarHealth}

			<DayTape
				timeline={projected.timeline}
				allDay={projected.allDay}
				nowLabel={view.nowLabel}
				domains={domains}
			/>

			{/* One tree, two compositions. The column wrappers dissolve below `lg`
			    (display: contents) and `order` re-sequences the same sections
			    orientation-first — Top 3 and Routines rise above the long lists
			    because the phone is where they get ticked off. If this ever needs
			    a <MobileToday>, something has gone wrong. */}
			<div className="t-cols mt-9 lg:mt-13">
				<div className="t-col t-col-main">
					<TimelineSection {...placement} nowUtcIso={view.nowUtcIso} />
					<OpenSection {...placement} />
					{quote}
				</div>
				<div className="t-col t-col-side">
					<Top3Section {...placement} />
					{aside}
				</div>
			</div>
		</div>
	);
}
