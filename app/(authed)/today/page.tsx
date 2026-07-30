import { Suspense } from "react";
import { SoftRefresh } from "@/components/soft-refresh";
import { requireOwnerPage } from "@/lib/auth";
import { formatDateline, parseDateIso, todayInTz } from "@/lib/dates";
import { getAppTimezone } from "@/lib/services/settings";
import { BriefingBody } from "./briefing-body";

// The shell (masthead frame + section placeholders) paints synchronously;
// the ~13-query briefing fan-out (lib/services/briefing.ts) streams in
// behind Suspense so the route doesn't block first paint on it. Masthead
// (with the page's real h1) only mounts once the briefing resolves, so this
// fallback carries its own h1 — mirroring Masthead's markup — rather than
// leaving the page headingless mid-stream.
function BriefingFallback({ todayIso }: { todayIso: string }) {
	return (
		<div>
			<header className="hairline-strong pb-5">
				<div className="flex items-baseline justify-between">
					<h1 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						{formatDateline(todayIso)}
					</h1>
				</div>
				<p className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">Dispatch</p>
			</header>

			<span role="status" className="sr-only">
				Loading
			</span>

			<div className="mt-12 space-y-4" aria-hidden="true">
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
	const tz = await getAppTimezone(sb);
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
			<Suspense key={selectedIso} fallback={<BriefingFallback todayIso={todayIso} />}>
				<BriefingBody sb={sb} tz={tz} todayIso={todayIso} selectedIso={selectedIso} />
			</Suspense>
		</div>
	);
}
