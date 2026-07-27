import { Suspense } from "react";
import { SoftRefresh } from "@/components/soft-refresh";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { getAppTimezone } from "@/lib/services/settings";
import { BriefingBody } from "./briefing-body";

// The shell (masthead frame + section placeholders) paints synchronously;
// the ~13-query briefing fan-out (lib/services/briefing.ts) streams in
// behind Suspense so the route doesn't block first paint on it.
function BriefingFallback() {
	return (
		<div>
			<header className="hairline-strong pb-5">
				<div className="flex items-baseline justify-between">
					<div className="h-3 w-24 rounded bg-surface animate-pulse" aria-hidden="true" />
				</div>
				<h1 className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">
					Dispatch
				</h1>
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

export default async function TodayPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);

	return (
		<div>
			{/* Keep the day tape "now", past events, and counts honest without a full reload. */}
			<SoftRefresh />
			<Suspense fallback={<BriefingFallback />}>
				<BriefingBody sb={sb} tz={tz} todayIso={todayIso} />
			</Suspense>
		</div>
	);
}
