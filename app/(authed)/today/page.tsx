import { Suspense } from "react";
import { SoftRefresh } from "@/components/soft-refresh";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatDateline, parseDateIso, todayInTz } from "@/lib/dates";
import { TodayBody } from "./today-body";

// The shell (masthead frame + section placeholders) paints synchronously;
// the ~13-query Today fan-out (lib/services/today.ts) streams in
// behind Suspense so the route doesn't block first paint on it. Masthead
// (with the page's real h1) only mounts once the Today read resolves, so this
// fallback carries its own h1 — mirroring Masthead's markup — rather than
// leaving the page headingless mid-stream.
function TodayFallback({ todayIso }: { todayIso: string }) {
	return (
		<div>
			<header className="hairline-strong pb-4">
				<div className="flex items-baseline justify-between">
					<h1 className="label">{formatDateline(todayIso)}</h1>
				</div>
				<p className="display-tight mt-1 w-fit font-serif text-4xl text-ink">Dispatch</p>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-14 space-y-4" aria-hidden="true">
				{Array.from({ length: 8 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 rounded bg-surface animate-pulse" />
				))}
			</div>
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
			{/* No key on selectedIso: day flips are client-owned (schedule
			 * Server Action) so chrome is not remounted. selectedIso only seeds
			 * the first paint / SoftRefresh from `?d=`. */}
			<Suspense fallback={<TodayFallback todayIso={todayIso} />}>
				<TodayBody sb={sb} tz={tz} todayIso={todayIso} selectedIso={selectedIso} />
			</Suspense>
		</div>
	);
}
