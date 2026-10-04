import { Suspense } from "react";
import { requireOwnerPage } from "@/lib/auth";
import { readClock } from "@/lib/cache/settings";
import { formatDay, parseDateIso } from "@/lib/dates";
import { SoftRefresh } from "./soft-refresh";
import { TodayBody } from "./today-body";
import { TodaySkeleton } from "./today-skeleton";

/*
 * The ~13-query Today fan-out (lib/services/today.ts) streams in behind
 * Suspense so the route doesn't block first paint on it. The dateline is the
 * one thing this side of the boundary already knows, so the fallback prints it
 * for real rather than as a bone.
 */
function TodayFallback({ todayIso }: { todayIso: string }) {
	return <TodaySkeleton dateline={formatDay(todayIso, "utc", "cccc, d LLLL yyyy")} />;
}

export default async function TodayPage({
	searchParams,
}: {
	searchParams: Promise<{ d?: string }>;
}) {
	const { sb } = await requireOwnerPage();
	const { tz, todayIso } = await readClock();

	// `?d=` is the day navigation's only state. Anything unparseable falls back
	// to today rather than erroring — a hand-edited URL should land somewhere
	// sensible, not on a crash.
	const { d } = await searchParams;
	const selectedIso = parseDateIso(d) ?? todayIso;

	return (
		<div>
			{/* Pulls Today into the entity store every five minutes (#4). */}
			<SoftRefresh todayIso={todayIso} />
			{/* No key on selectedIso: day flips are client-owned (schedule Server
			 * Action) so chrome is not remounted. selectedIso only seeds the first
			 * paint from `?d=`. */}
			<Suspense fallback={<TodayFallback todayIso={todayIso} />}>
				<TodayBody sb={sb} tz={tz} todayIso={todayIso} selectedIso={selectedIso} />
			</Suspense>
		</div>
	);
}
