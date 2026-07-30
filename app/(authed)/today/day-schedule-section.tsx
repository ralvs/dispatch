"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { parseDateIso } from "@/lib/dates";
import type { DaySchedule as DayScheduleView } from "@/lib/services/briefing";
import { type DaySchedulePayload, loadDayScheduleAction } from "./actions";
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

	// SoftRefresh / revalidatePath re-renders this tree from the server with a
	// fresh schedule for the URL day — adopt it without a client fetch.
	useEffect(() => {
		setView(fromProps({ schedule, dateIso, nowUtcIso, nowLabel, eventNoteIds, taskNoteIds }));
	}, [schedule, dateIso, nowUtcIso, nowLabel, eventNoteIds, taskNoteIds]);

	const selectDay = useCallback(
		(nextIso: string, opts?: { syncUrl?: boolean }) => {
			if (nextIso === view.dateIso) return;
			const gen = ++requestGen.current;
			if (opts?.syncUrl !== false) {
				window.history.replaceState(window.history.state, "", hrefFor(nextIso, todayIso));
			}
			startTransition(async () => {
				const payload: DaySchedulePayload = await loadDayScheduleAction(nextIso);
				if (gen !== requestGen.current) return;
				setView({
					schedule: payload.schedule,
					dateIso: payload.dateIso,
					nowUtcIso: payload.nowUtcIso,
					nowLabel: payload.nowLabel,
					eventNoteIds: payload.eventNoteIds,
					taskNoteIds: payload.taskNoteIds,
				});
			});
		},
		[view.dateIso, todayIso],
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
