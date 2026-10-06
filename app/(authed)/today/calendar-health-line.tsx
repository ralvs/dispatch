"use client";

import { useState, useTransition } from "react";
import { describeFeedHealth, type FeedHealth } from "@/lib/calendar-health";
import { runAction } from "@/lib/client/toast";
import { useStoreActions } from "@/lib/store";
import { pullTodayAction, syncIcloudCalendarAction } from "./actions";

/**
 * One quiet line per calendar feed that is stale or failing (#96), under
 * Today's headline. On a healthy day it renders nothing, so an empty day
 * reads as free only when the calendars are current.
 *
 * The iCloud feed gets "Sync now": the action runs the CalDAV sync and
 * answers with the feeds' health, then the day is pulled into the entity
 * store like SoftRefresh does, so any event the sync brought in shows at
 * once. The work feed has no button — the Mac bridge pushes; the server
 * cannot ask it to.
 */
export function CalendarHealthLine({
	health,
	tz,
	todayIso,
}: {
	health: FeedHealth[];
	tz: string;
	todayIso: string;
}) {
	const { seed } = useStoreActions();
	const [pending, startTransition] = useTransition();
	const [fromServer, setFromServer] = useState(health);
	const [shown, setShown] = useState(health);
	// A new server render wins over the last action's answer.
	if (fromServer !== health) {
		setFromServer(health);
		setShown(health);
	}

	function syncNow() {
		startTransition(async () => {
			await runAction(async () => {
				const result = await syncIcloudCalendarAction();
				if (!result.ok) throw new Error(result.formError);
				setShown(result.data);
				const shownDay = new URLSearchParams(window.location.search).get("d") ?? undefined;
				for (const snapshot of await pullTodayAction(shownDay)) seed(snapshot);
			}, "Couldn't sync the iCloud calendar.");
		});
	}

	if (shown.length === 0) return null;

	return (
		<ul aria-label="Calendar sync" className="mt-3 space-y-1 font-mono text-meta text-ink-3">
			{shown.map((h) => (
				<li key={h.feed} className="flex flex-wrap items-baseline gap-x-3">
					<span>{describeFeedHealth(h, tz, todayIso)}</span>
					{h.feed === "icloud" && (
						<button
							type="button"
							onClick={syncNow}
							disabled={pending}
							className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink disabled:opacity-60"
						>
							{pending ? "Syncing…" : "Sync now"}
						</button>
					)}
				</li>
			))}
		</ul>
	);
}
