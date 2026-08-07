import { Suspense } from "react";
import { SoftRefresh } from "@/components/soft-refresh";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatDay, parseDateIso, todayInTz } from "@/lib/dates";
import { TodayBody } from "./today-body";

/*
 * The ~13-query Today fan-out (lib/services/today.ts) streams in behind
 * Suspense so the route doesn't block first paint on it. The dateline is the
 * one thing this side of the boundary already knows, so the fallback prints it
 * for real rather than as a grey bar — and it carries the page's h1, since
 * DayHeadline (the real one) only mounts once the read resolves.
 */
function TodayFallback({ todayIso }: { todayIso: string }) {
	return (
		<div>
			<p className="mb-4 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
				{formatDay(todayIso, "utc", "cccc, d LLLL yyyy")}
			</p>
			<h1 className="max-w-[16ch] text-t36 text-ink-4 lg:text-hero">Reading the day…</h1>
			<span role="status" className="sr-only">
				Loading
			</span>
			<div className="mt-10 h-[46px] rounded-[12px] bg-surface-2" aria-hidden="true" />
		</div>
	);
}

export default async function TodayPage({
	searchParams,
}: {
	searchParams: Promise<{ d?: string }>;
}) {
	const { sb } = await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);

	// `?d=` is the day navigation's only state. Anything unparseable falls back
	// to today rather than erroring — a hand-edited URL should land somewhere
	// sensible, not on a crash.
	const { d } = await searchParams;
	const selectedIso = parseDateIso(d) ?? todayIso;

	return (
		<div>
			{/* Keep the day tape "now", past events, and counts honest without a full reload. */}
			<SoftRefresh />
			{/* No key on selectedIso: day flips are client-owned (schedule Server
			 * Action) so chrome is not remounted. selectedIso only seeds the first
			 * paint / SoftRefresh from `?d=`. */}
			<Suspense fallback={<TodayFallback todayIso={todayIso} />}>
				<TodayBody sb={sb} tz={tz} todayIso={todayIso} selectedIso={selectedIso} />
			</Suspense>
		</div>
	);
}
