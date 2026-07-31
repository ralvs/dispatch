"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { parseDateIso } from "@/lib/dates";
import {
	type DayCacheEntry,
	type DaySignature,
	daySignature,
	keysToEvict,
	MAX_CACHED_DAYS,
	readDay,
	reconcileDay,
} from "@/lib/day-nav/revalidation";
// DaySchedulePayload comes straight from lib/, not through actions.ts: a
// "use server" module may only export async functions, and a re-exported type
// there survives into the server-actions loader as an undefined binding.
import type { DaySchedulePayload, DaySchedule as DayScheduleView } from "@/lib/services/briefing";
import { loadDayScheduleAction } from "./actions";
import { DayNav } from "./day-nav";
import { DaySchedule } from "./day-schedule";
import { DayTape } from "./day-tape";

function hrefFor(dateIso: string, todayIso: string): string {
	return dateIso === todayIso ? "/today" : `/today?d=${dateIso}`;
}

type View = {
	schedule: DayScheduleView;
	dateIso: string;
	nowUtcIso: string;
	nowLabel: string | null;
	eventNoteIds: Record<string, string>;
	taskNoteIds: Record<string, string>;
};

function fromProps(props: {
	schedule: DayScheduleView;
	dateIso: string;
	nowUtcIso: string;
	nowLabel: string | null;
	eventNoteIds?: Record<string, string>;
	taskNoteIds?: Record<string, string>;
}): View {
	return {
		schedule: props.schedule,
		dateIso: props.dateIso,
		nowUtcIso: props.nowUtcIso,
		nowLabel: props.nowLabel,
		eventNoteIds: props.eventNoteIds ?? {},
		taskNoteIds: props.taskNoteIds ?? {},
	};
}

// The day tape + schedule list. Day navigation is client-owned so a chevron
// only reloads getDaySchedule (via Server Action) — never the full briefing
// RSC payload or the route loading.tsx skeleton. `?d=` is kept in the URL
// with history.replaceState for deep links and SoftRefresh honesty.
export function DayScheduleSection({
	schedule,
	dateIso,
	todayIso,
	nowUtcIso,
	nowLabel,
	eventNoteIds,
	taskNoteIds,
}: {
	schedule: DayScheduleView;
	/** The day on screen. Equals todayIso unless the day nav has moved. */
	dateIso: string;
	todayIso: string;
	nowUtcIso: string;
	/** Null on any day but today — there is no "now" to mark on another day. */
	nowLabel: string | null;
	eventNoteIds?: Record<string, string>;
	taskNoteIds?: Record<string, string>;
}) {
	const [view, setView] = useState<View>(() =>
		fromProps({ schedule, dateIso, nowUtcIso, nowLabel, eventNoteIds, taskNoteIds }),
	);
	const [pending, startTransition] = useTransition();
	// Ignore stale action results when the user clicks faster than the network.
	const requestGen = useRef(0);
	// Days visited this session, keyed by dateIso, each carrying the payload it
	// last resolved to plus a signature + fetch time — readDay/revalidate below
	// use those to decide instant-vs-fetch and stale-vs-fresh. SoftRefresh's
	// revalidatePath still refreshes the entry currently on screen (the effect
	// below), and background revalidation keeps the rest from going stale for
	// longer than REVALIDATE_AFTER_MS.
	const cache = useRef(new Map<string, DayCacheEntry>());
	// What's actually on screen right now, kept outside React state so a
	// background revalidate() resolving later reads the current day/signature
	// rather than the one captured in its own closure at request time.
	// Seeded through a lazy useState initializer rather than inline in useRef:
	// useRef evaluates its argument on every render and discards it after the
	// first, and daySignature stringifies the whole day.
	const [initialVisible] = useState<{ dateIso: string; signature: DaySignature }>(() => ({
		dateIso: view.dateIso,
		signature: daySignature(view),
	}));
	const visibleRef = useRef(initialVisible);
	// Dedupes concurrent background revalidations per day.
	const inFlight = useRef(new Set<string>());
	const todayIsoRef = useRef(todayIso);

	const commit = useCallback((entry: DayCacheEntry) => {
		visibleRef.current = { dateIso: entry.payload.dateIso, signature: entry.signature };
		setView(fromProps(entry.payload));
	}, []);

	// Every write into the cache goes through here so the bound is enforced on
	// all three paths (foreground miss, background revalidate, prop sync) —
	// chevron-stepping a month forward would otherwise grow it without limit.
	// The day on screen is what needs protecting: the entry just stored carries
	// the newest fetchedAtMs, so oldest-first eviction can never reach it.
	const store = useCallback((entry: DayCacheEntry) => {
		cache.current.set(entry.payload.dateIso, entry);
		for (const key of keysToEvict(cache.current, MAX_CACHED_DAYS, visibleRef.current.dateIso)) {
			cache.current.delete(key);
		}
	}, []);

	// Background refetch for a cached-but-aged day. Deliberately NOT wrapped in
	// startTransition — `pending` (and the opacity-70 dim it drives) comes from
	// the one useTransition above and must stay false here, since a background
	// refresh should never look like a foreground fetch.
	const revalidate = useCallback(
		(nextIso: string) => {
			if (inFlight.current.has(nextIso)) return;
			// Don't burn a phone's radio revalidating a day nobody's looking at
			// (matches components/soft-refresh.tsx's visibility check).
			if (document.visibilityState !== "visible") return;
			inFlight.current.add(nextIso);
			loadDayScheduleAction(nextIso)
				.then((payload) => {
					const signature = daySignature(payload);
					const fetchedAtMs = Date.now();
					// Always cache the result, even for a day the user already left —
					// a later revisit should see it, not refetch again.
					store({ payload, signature, fetchedAtMs });
					const visible = visibleRef.current;
					const { adopt } = reconcileDay({
						incomingSignature: signature,
						incomingDateIso: nextIso,
						visibleDateIso: visible.dateIso,
						visibleSignature: visible.signature,
					});
					if (adopt) commit({ payload, signature, fetchedAtMs });
				})
				.catch((error) => {
					// A failed background refresh must be invisible — the user still has
					// correct-as-of-a-minute-ago content on screen. Not routed through
					// runAction, which would toast it as a foreground failure.
					unstable_rethrow(error);
				})
				.finally(() => {
					inFlight.current.delete(nextIso);
				});
		},
		[commit, store],
	);

	// SoftRefresh / revalidatePath re-renders this tree from the server with a
	// fresh schedule for the URL day. Stamp it into the cache; adopt it only
	// when the signature actually changed — eventNoteIds/taskNoteIds are fresh
	// object literals on every RSC render, so without this gate a redundant
	// setView (and full day-section re-render) fires on every SoftRefresh tick
	// and every revalidatePath even when nothing moved. When `content` (not
	// just `time`) changed, a write just landed, so the other cached days are
	// dropped rather than waiting out the 60s timer. Note this only catches
	// writes that move the *visible* day: one touching solely another day
	// leaves that day's entry in place, and the 60s revalidation is what
	// corrects it.
	useEffect(() => {
		// Day-rollover guard: nowLabel is non-null only when a day was today *at
		// fetch time* (actions.ts), so after midnight a cached "today" entry
		// would still draw a stale now-marker. A PWA left open overnight hits
		// this, hence keying the whole cache off todayIso rather than trusting
		// any one entry's own nowLabel. This is reactive: todayIso only changes
		// when the RSC re-renders, so between midnight and the next SoftRefresh
		// tick (≤5 min, or a tab refocus) a cached entry can still be served.
		if (todayIsoRef.current !== todayIso) {
			cache.current.clear();
			todayIsoRef.current = todayIso;
		}

		const payload = fromProps({
			schedule,
			dateIso,
			nowUtcIso,
			nowLabel,
			eventNoteIds,
			taskNoteIds,
		});
		const signature = daySignature(payload);
		const fetchedAtMs = Date.now();
		store({ payload, signature, fetchedAtMs });

		const visible = visibleRef.current;
		const unchanged =
			visible.dateIso === dateIso &&
			visible.signature.content === signature.content &&
			visible.signature.time === signature.time;
		if (unchanged) return;

		if (visible.signature.content !== signature.content) {
			// Keep the day this render is for and the one actually on screen —
			// an RSC render for day A can land just after a flip to day B, and
			// evicting B would cost a skeleton on the next return to it.
			for (const key of [...cache.current.keys()]) {
				if (key !== dateIso && key !== visible.dateIso) cache.current.delete(key);
			}
		}

		commit({ payload, signature, fetchedAtMs });
	}, [schedule, dateIso, nowUtcIso, nowLabel, eventNoteIds, taskNoteIds, todayIso, commit, store]);

	const selectDay = useCallback(
		(nextIso: string, opts?: { syncUrl?: boolean }) => {
			if (nextIso === view.dateIso) return;
			const gen = ++requestGen.current;
			if (opts?.syncUrl !== false) {
				window.history.replaceState(window.history.state, "", hrefFor(nextIso, todayIso));
			}

			// Cache-hit-wins: an aged entry still paints instantly, it just also
			// kicks off a background revalidate() — never a skeleton for a day
			// already seen.
			const decision = readDay(cache.current, nextIso, Date.now());
			if (decision.kind === "hit") {
				commit(decision.entry);
				if (decision.revalidate) revalidate(nextIso);
				return;
			}

			startTransition(async () => {
				const payload: DaySchedulePayload = await loadDayScheduleAction(nextIso);
				if (gen !== requestGen.current) return;
				const signature = daySignature(payload);
				const fetchedAtMs = Date.now();
				// commit before store so the day becoming visible is the one
				// store() protects from eviction, rather than the outgoing one.
				commit({ payload, signature, fetchedAtMs });
				store({ payload, signature, fetchedAtMs });
			});
		},
		[view.dateIso, todayIso, commit, store, revalidate],
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

	return (
		<div className={pending ? "opacity-70 transition-opacity" : undefined}>
			<DayTape
				timeline={view.schedule.timeline}
				dateIso={view.dateIso}
				nowLabel={view.nowLabel}
				nowUtcIso={view.nowUtcIso}
				nav={
					<DayNav
						dateIso={view.dateIso}
						todayIso={todayIso}
						pending={pending}
						onSelect={selectDay}
					/>
				}
			/>
			<DaySchedule
				schedule={view.schedule}
				dateIso={view.dateIso}
				todayIso={todayIso}
				nowUtcIso={view.nowUtcIso}
				eventNoteIds={view.eventNoteIds}
				taskNoteIds={view.taskNoteIds}
			/>
		</div>
	);
}
